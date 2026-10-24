package com.activ

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(ReportExportPackage())
          add(PaymentAppPackage())
          add(AppUpdatePackage())
          add(ActivNotificationsPackage())
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      val channel = android.app.NotificationChannel("activ_updates", "ACTIV updates", android.app.NotificationManager.IMPORTANCE_HIGH)
      channel.description = "Events, association updates, membership and messages"
      channel.lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
      getSystemService(android.app.NotificationManager::class.java).createNotificationChannel(channel)
    }
    loadReactNative(this)
  }
}
