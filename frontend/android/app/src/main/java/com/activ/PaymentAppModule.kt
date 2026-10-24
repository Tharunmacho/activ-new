package com.activ

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/** Launch only a browsable VIEW of the gateway URI, never arbitrary intent extras. */
class PaymentAppModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "PaymentApp"

  @ReactMethod
  fun open(raw: String, promise: Promise) {
    try {
      require(raw.length <= 16384 && raw.none { it <= ' ' || it == '\\' })
      val parsed = if (raw.startsWith("intent:", ignoreCase = true)) {
        Intent.parseUri(raw, Intent.URI_INTENT_SCHEME)
      } else Intent(Intent.ACTION_VIEW, Uri.parse(raw))
      val uri = parsed.data ?: throw IllegalArgumentException("Missing payment URI")
      val scheme = uri.scheme?.lowercase() ?: ""
      require(scheme.matches(Regex("[a-z][a-z0-9+.-]*")))
      require(scheme !in setOf("intent", "javascript", "data", "file", "content", "blob", "about", "android-app", "market", "activ", "http"))
      // HTTPS app intents (some bank/wallet providers) must name their package.
      require(scheme != "https" || !parsed.`package`.isNullOrBlank())
      val target = Intent(Intent.ACTION_VIEW, uri).apply {
        addCategory(Intent.CATEGORY_BROWSABLE)
        parsed.`package`?.let { setPackage(it) }
      }
      val activity = context.currentActivity
      if (activity != null) activity.startActivity(target)
      else context.startActivity(target.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(true)
    } catch (error: ActivityNotFoundException) {
      promise.reject("PAYMENT_APP_UNAVAILABLE", "This payment app is not installed. Choose another method.")
    } catch (error: Exception) {
      promise.reject("PAYMENT_APP_UNAVAILABLE", "The payment app could not be opened. Choose another method.")
    }
  }
}

class PaymentAppPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(PaymentAppModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
