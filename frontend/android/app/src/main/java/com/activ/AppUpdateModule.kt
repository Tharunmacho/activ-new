package com.activ

import android.content.Intent
import android.net.Uri
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.UpdateAvailability

/** Real installed build identity and Play availability for this device/account. */
class AppUpdateModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "AppUpdate"

  override fun getConstants(): Map<String, Any> = mapOf(
    "versionCode" to BuildConfig.VERSION_CODE,
    "versionName" to BuildConfig.VERSION_NAME,
    "packageName" to context.packageName
  )

  @ReactMethod
  fun checkAvailability(promise: Promise) {
    try {
      AppUpdateManagerFactory.create(context).appUpdateInfo
        .addOnSuccessListener { info ->
          val state = info.updateAvailability()
          val available = state == UpdateAvailability.UPDATE_AVAILABLE ||
            state == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
          if (!available && state != UpdateAvailability.UPDATE_NOT_AVAILABLE) {
            promise.reject("PLAY_CHECK_UNAVAILABLE", "Google Play has not confirmed update availability.")
            return@addOnSuccessListener
          }
          promise.resolve(Arguments.createMap().apply {
            putBoolean("available", available)
            putInt("availableVersionCode", if (available) info.availableVersionCode() else 0)
          })
        }
        .addOnFailureListener { promise.reject("PLAY_CHECK_UNAVAILABLE", "Google Play could not confirm an update.", it) }
    } catch (error: Exception) {
      promise.reject("PLAY_CHECK_UNAVAILABLE", "Google Play could not confirm an update.", error)
    }
  }

  @ReactMethod
  fun openStore(promise: Promise) {
    try {
      val market = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=${context.packageName}"))
        .setPackage("com.android.vending").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try { context.startActivity(market) }
      catch (_: android.content.ActivityNotFoundException) {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=${context.packageName}"))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("PLAY_STORE_UNAVAILABLE", "Google Play could not be opened. Please try again.", error)
    }
  }
}

class AppUpdatePackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(AppUpdateModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
