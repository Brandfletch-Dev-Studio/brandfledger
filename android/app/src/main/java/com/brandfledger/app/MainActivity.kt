package com.brandfledger.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    companion object {
        private const val APP_URL = "https://brandfledger-three.vercel.app"
        private val ALLOWED_HOSTS = listOf(
            "brandfledger-three.vercel.app",
            "vercel.app",
            "supabase.co",
            "paychangu.com",
            "api.resend.com"
        )
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge display
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = Color.parseColor("#4338CA")

        webView = WebView(this)
        setContentView(webView)

        // Configure WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString BrandfledgerApp/1.0"
            setSupportZoom(false)
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        // Enable dark mode adaptation
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setForceDark(webView.settings, WebSettingsCompat.DARK_STRATEGY_WEB_THEME_ALGORITHM_DARKENING_ONLY)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return false
                val host = url.host ?: return false

                // Internal URLs — load in WebView
                if (ALLOWED_HOSTS.any { host.endsWith(it) }) {
                    return false
                }

                // External URLs — open in browser
                try {
                    val intent = Intent(Intent.ACTION_VIEW, url)
                    startActivity(intent)
                } catch (e: Exception) {}
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Inject CSS to hide PWA install prompts and adjust for native app
                val css = """
                    (function() {
                        var style = document.createElement('style');
                        style.textContent = 'body{user-select:none;-webkit-user-select:none}input,textarea{user-select:text;-webkit-user-select:text}';
                        document.head.appendChild(style);
                    })();
                """.trimIndent()
                view?.evaluateJavascript(css, null)
            }
        }

        // Handle back navigation
        webView.setOnKeyListener { _, keyCode, event ->
            if (keyCode == android.view.KeyEvent.KEYCODE_BACK && event.action == android.view.KeyEvent.ACTION_UP) {
                if (webView.canGoBack()) {
                    webView.goBack()
                    true
                } else {
                    false
                }
            } else {
                false
            }
        }

        // Load app
        val targetUrl = intent?.data?.toString() ?: APP_URL
        webView.loadUrl(targetUrl)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        webView.restoreState(savedInstanceState)
    }
}
