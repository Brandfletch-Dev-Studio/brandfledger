# Add project specific ProGuard rules here.

# WebView
-keepclassmembers class android.webkit.WebView {
   public *;
}
-keepclassmembers class * extends android.webkit.WebViewClient {
   public *;
}

# Kotlin
-keep class com.brandfledger.app.** { *; }
