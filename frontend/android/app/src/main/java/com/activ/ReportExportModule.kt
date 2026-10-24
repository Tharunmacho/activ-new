package com.activ

import android.Manifest
import android.app.DownloadManager
import android.content.Context
import android.content.ContentValues
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.pdf.PdfDocument
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.SystemClock
import android.provider.MediaStore
import android.util.Base64
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.uimanager.UIManagerHelper
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.URI
import java.net.HttpURLConnection
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.min

/** All generated documents stay in the device's public Downloads directory. */
class ReportExportModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val busy = AtomicBoolean(false)
  private data class DownloadReceipt(val id: Long, val filename: String, val queuedAt: Long)
  private val downloadLock = Any()
  private val recentDownloads = mutableMapOf<String, DownloadReceipt>()
  override fun getName() = "ReportExport"

  private fun begin(promise: Promise): Boolean {
    if (busy.compareAndSet(false, true)) return true
    promise.reject("EXPORT_BUSY", "Wait for the current download to finish.")
    return false
  }

  @ReactMethod
  fun saveCsv(filename: String, csv: String, promise: Promise) {
    if (begin(promise)) writeAsync(filename, "text/csv", promise) { csv.toByteArray(Charsets.UTF_8) }
  }

  @ReactMethod
  fun saveSpreadsheet(filename: String, base64: String, promise: Promise) {
    if (!begin(promise)) return
    writeAsync(filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", promise) {
      val bytes = Base64.decode(base64, Base64.DEFAULT)
      require(bytes.size >= 4 && bytes[0] == 0x50.toByte() && bytes[1] == 0x4B.toByte()) { "Invalid Excel workbook." }
      bytes
    }
  }

  /** Private chat files use the app session only for this fixed API endpoint.
   * Redirects are refused so credentials never follow an external file URL. */
  @ReactMethod
  fun downloadChatFile(url: String, token: String, filename: String, mimeType: String, promise: Promise) {
    if (!begin(promise)) return
    writeAsync(filename, mimeType, promise) {
      val parsed = URI(url)
      require(parsed.scheme == "https" && parsed.host == "api.activ.org.in" && parsed.port == -1
        && parsed.rawUserInfo == null && parsed.query == null && parsed.fragment == null
        && parsed.path.matches(Regex("/api/v[0-9]+/messages/attachments/[a-fA-F0-9-]{36}"))) { "Invalid private attachment endpoint." }
      require(token.isNotBlank() && !token.contains('\n') && !token.contains('\r')) { "Sign in again to download this attachment." }
      val connection = parsed.toURL().openConnection() as HttpURLConnection
      try {
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 20000
        connection.readTimeout = 60000
        connection.setRequestProperty("Authorization", "Bearer $token")
        connection.setRequestProperty("Accept", mimeType)
        check(connection.responseCode == 200) { "The attachment is unavailable or your membership no longer permits access." }
        check(connection.contentLengthLong <= 10L * 1024 * 1024) { "The attachment exceeds 10 MB." }
        connection.inputStream.use { input ->
          val out = ByteArrayOutputStream()
          val chunk = ByteArray(16384)
          while (true) {
            val count = input.read(chunk)
            if (count < 0) break
            check(out.size() + count <= 10 * 1024 * 1024) { "The attachment exceeds 10 MB." }
            out.write(chunk, 0, count)
          }
          check(out.size() > 0) { "The attachment is empty." }
          out.toByteArray()
        }
      } finally { connection.disconnect() }
    }
  }

  /** Public HTTPS attachments only. DownloadManager owns progress/completion;
   * enqueueing is not evidence that the file has finished downloading. */
  @ReactMethod
  fun downloadPublicFile(url: String, filename: String, promise: Promise) {
    Thread {
      try {
        val parsed = URI(url)
        require(parsed.scheme.equals("https", ignoreCase = true) && !parsed.host.isNullOrBlank()
          && parsed.rawUserInfo == null && parsed.fragment == null
          && (parsed.port == -1 || parsed.port in 1..65535)) { "Choose a valid public HTTPS file link." }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
          check(context.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED) {
            "Allow storage access to download files to Downloads."
          }
        }
        val receipt = synchronized(downloadLock) {
          val now = SystemClock.elapsedRealtime()
          recentDownloads.entries.removeAll { now - it.value.queuedAt > 5000 }
          recentDownloads[url] ?: run {
            val safeName = filename.replace(Regex("[^\\p{L}\\p{N}\\p{M}._ -]"), "-")
              .trim('.', ' ').take(120).ifBlank { "activ-download" }
            val extension = safeName.substringAfterLast('.', "")
              .takeIf { it.matches(Regex("[A-Za-z0-9]{1,10}")) }?.let { ".$it" } ?: ""
            val stem = if (extension.isEmpty()) safeName else safeName.dropLast(extension.length)
            // A fresh destination every time; never replace an existing file.
            val uniqueName = "${stem.take(60)}-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(8)}$extension"
            val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
              ?: throw IllegalStateException("Android Downloads is unavailable.")
            val request = DownloadManager.Request(Uri.parse(parsed.toASCIIString()))
              .setTitle(safeName)
              .setDescription("ACTIV attachment · Downloads")
              .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, uniqueName)
              .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            // Do not copy app authorization headers or cookies to public hosts.
            val id = manager.enqueue(request)
            check(id > 0) { "Android could not start this download." }
            DownloadReceipt(id, uniqueName, now).also { recentDownloads[url] = it }
          }
        }
        promise.resolve(Arguments.createMap().apply {
          putString("id", receipt.id.toString())
          putString("filename", receipt.filename)
          putString("status", "started")
        })
      } catch (error: Exception) {
        promise.reject("DOWNLOAD_FAILED", "The download could not be started. Check the file link, storage permission and Android Downloads, then try again.", error)
      }
    }.start()
  }

  /** Draw the complete, unscaled sheet. Membership is landscape; tax is portrait. */
  @ReactMethod
  fun savePdf(filename: String, reactTag: Double, promise: Promise) {
    if (!begin(promise)) return
    context.runOnUiQueueThread {
      try {
        val tag = reactTag.toInt()
        val view = UIManagerHelper.getUIManagerForReactTag(context, tag)?.resolveView(tag)
          ?: throw IllegalStateException("The certificate is not ready.")
        check(view.width > 0 && view.height > 0) { "The certificate is still loading." }
        val landscape = view.width > view.height
        val pageWidth = if (landscape) 842 else 595
        val pageHeight = if (landscape) 595 else 842
        val bytes = ByteArrayOutputStream()
        val document = PdfDocument()
        try {
          val page = document.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, 1).create())
          try {
            page.canvas.drawColor(Color.WHITE)
            val scale = min(pageWidth.toFloat() / view.width, pageHeight.toFloat() / view.height)
            page.canvas.translate((pageWidth - view.width * scale) / 2f, (pageHeight - view.height * scale) / 2f)
            page.canvas.scale(scale, scale)
            view.draw(page.canvas)
          } finally { document.finishPage(page) }
          document.writeTo(bytes)
        } finally { document.close() }
        writeAsync(filename, "application/pdf", promise) { bytes.toByteArray() }
      } catch (error: Exception) {
        busy.set(false)
        promise.reject("PDF_FAILED", "The PDF could not be prepared. Wait for the certificate to load and try again.", error)
      }
    }
  }

  private fun writeAsync(filename: String, mimeType: String, promise: Promise, data: () -> ByteArray) {
    Thread {
      try {
        val safeName = filename.replace(Regex("[^a-zA-Z0-9._ -]"), "-").trimStart('.', ' ').take(140)
        require(safeName.isNotBlank()) { "A filename is required." }
        val bytes = data()
        require(bytes.isNotEmpty()) { "The file is empty." }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val resolver = context.contentResolver
          val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, safeName)
            put(MediaStore.Downloads.MIME_TYPE, mimeType)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            put(MediaStore.Downloads.IS_PENDING, 1)
          }
          val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("Downloads could not be opened.")
          try {
            (resolver.openOutputStream(uri) ?: throw IllegalStateException("Downloads could not be written."))
              .use { it.write(bytes) }
            check(resolver.update(uri, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null) > 0)
          } catch (error: Exception) {
            // Only remove the incomplete file created by this request.
            resolver.delete(uri, null, null)
            throw error
          }
        } else {
          check(context.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED) {
            "Allow storage access to save files in Downloads."
          }
          @Suppress("DEPRECATION")
          val directory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
          check(directory.isDirectory || directory.mkdirs()) { "Downloads could not be opened." }
          val stem = safeName.substringBeforeLast('.', safeName)
          val extension = safeName.substringAfterLast('.', "").let { if (it.isEmpty()) "" else ".$it" }
          var file = File(directory, safeName)
          var suffix = 1
          // Never overwrite an earlier download, including concurrent writers.
          while (!file.createNewFile()) {
            check(suffix <= 10000) { "Too many files have the same name." }
            file = File(directory, "$stem (${suffix++})$extension")
          }
          try { file.outputStream().use { it.write(bytes) } }
          catch (error: Exception) { file.delete(); throw error }
          MediaScannerConnection.scanFile(context, arrayOf(file.absolutePath), arrayOf(mimeType), null)
        }
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("EXPORT_FAILED", "The file could not be saved in Downloads. Check available storage and try again.", error)
      } finally { busy.set(false) }
    }.start()
  }
}

class ReportExportPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(ReportExportModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
