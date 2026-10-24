package com.activ

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ViewManager
import org.json.JSONObject

/** Foreground FCM delivery needs an explicit tray notification on Android. */
class ActivNotificationsModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  companion object {
    private const val CHANNEL = "activ_updates"
    private const val OPEN_DATA = "com.activ.notification.OPEN_DATA"
    private const val OPEN_EVENT = "activ:notification-opened"
  }

  private var listeners = 0
  private var pendingOpen: String? = null
  private val activityListener = object : BaseActivityEventListener() {
    override fun onNewIntent(intent: Intent) {
      val data = intent.getStringExtra(OPEN_DATA) ?: return
      intent.removeExtra(OPEN_DATA)
      val parsed = runCatching { messageData(data) }.getOrNull() ?: return
      pendingOpen = data
      if (listeners > 0 && context.hasActiveReactInstance()) {
        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(OPEN_EVENT, parsed)
        pendingOpen = null
      }
    }
  }

  init { context.addActivityEventListener(activityListener) }
  override fun getName() = "ActivNotifications"
  override fun invalidate() { context.removeActivityEventListener(activityListener); super.invalidate() }

  private fun channelEnabled(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
    (context.getSystemService(android.app.NotificationManager::class.java)
      .getNotificationChannel(CHANNEL)?.importance ?: android.app.NotificationManager.IMPORTANCE_NONE) >
      android.app.NotificationManager.IMPORTANCE_NONE

  @ReactMethod
  fun areNotificationsEnabled(promise: Promise) {
    promise.resolve(NotificationManagerCompat.from(context).areNotificationsEnabled() && channelEnabled())
  }

  @ReactMethod
  fun openSettings(promise: Promise) {
    try {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        NotificationManagerCompat.from(context).areNotificationsEnabled() &&
        context.getSystemService(android.app.NotificationManager::class.java).getNotificationChannel(CHANNEL) != null) {
        Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
          .putExtra(Settings.EXTRA_CHANNEL_ID, CHANNEL)
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:${context.packageName}"))
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(true)
    } catch (error: Exception) { promise.reject("NOTIFICATION_SETTINGS", "Notification settings could not be opened.", error) }
  }

  @ReactMethod
  fun show(id: String, title: String, body: String, data: ReadableMap, promise: Promise) {
    try {
      val manager = NotificationManagerCompat.from(context)
      if (!manager.areNotificationsEnabled() || !channelEnabled()) { promise.resolve(false); return }
      val tag = "activ-foreground:$id"
      val intent = Intent(context, MainActivity::class.java)
        .setAction("${context.packageName}.notification.$id")
        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        .putExtra(OPEN_DATA, JSONObject(data.toHashMap()).toString())
      val tap = PendingIntent.getActivity(context, tag.hashCode(), intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val notification = NotificationCompat.Builder(context, CHANNEL)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(title.take(200))
        .setContentText(body.take(1800))
        .setStyle(NotificationCompat.BigTextStyle().bigText(body.take(1800)))
        .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setDefaults(NotificationCompat.DEFAULT_SOUND)
        .setAutoCancel(true).setOnlyAlertOnce(true).setContentIntent(tap).build()
      manager.notify(tag, 0, notification)
      promise.resolve(true)
    } catch (_: SecurityException) { promise.resolve(false) }
    catch (error: Exception) { promise.reject("NOTIFICATION_DISPLAY", "Notification could not be displayed.", error) }
  }

  private fun messageData(raw: String) = Arguments.createMap().apply {
    val json = JSONObject(raw)
    json.keys().forEach { key -> putString(key, json.optString(key)) }
  }

  @ReactMethod
  fun getInitialOpen(promise: Promise) {
    try {
      val intent = context.currentActivity?.intent
      val data = pendingOpen ?: intent?.getStringExtra(OPEN_DATA)
      pendingOpen = null
      intent?.removeExtra(OPEN_DATA)
      promise.resolve(data?.let { messageData(it) })
    } catch (error: Exception) { promise.reject("NOTIFICATION_OPEN", "Notification could not be opened.", error) }
  }

  @ReactMethod fun addListener(eventName: String) { if (eventName == OPEN_EVENT) listeners += 1 }
  @ReactMethod fun removeListeners(count: Int) { listeners = (listeners - count).coerceAtLeast(0) }
}

class ActivNotificationsPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(ActivNotificationsModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
