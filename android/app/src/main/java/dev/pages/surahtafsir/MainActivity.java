package dev.pages.surahtafsir;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import java.io.IOException;
import java.io.InputStream;

/** Shows the bundled site (assets/www) at https://appassets.androidplatform.net/. */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView web;
    private boolean full = false;

    /** Static-site paths: "/surah/2/" → www/surah/2/index.html. */
    private final WebViewAssetLoader.PathHandler site = path -> {
        String p = path;
        if (p.isEmpty() || p.endsWith("/")) p += "index.html";
        else if (!p.substring(p.lastIndexOf('/') + 1).contains(".")) p += "/index.html";
        try {
            InputStream in = getAssets().open("www/" + p);
            return new WebResourceResponse(mime(p), mime(p).startsWith("text") || p.endsWith(".js") || p.endsWith(".json") ? "utf-8" : null, in);
        } catch (IOException e) {
            return null;
        }
    };

    private static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        bars("light");
        // fullscreen: draw under the camera hole instead of leaving a black strip there
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);

        WebViewAssetLoader loader = new WebViewAssetLoader.Builder().setDomain(HOST).addPathHandler("/", site).build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return loader.shouldInterceptRequest(r.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "SurahNative");
        if (state != null) web.restoreState(state);
        else web.loadUrl("https://" + HOST + "/");
    }

    private void bars(String theme) {
        boolean dark = "dark".equals(theme);
        int c = dark ? Color.parseColor("#1d1a15") : Color.WHITE;
        getWindow().setStatusBarColor(c);
        getWindow().setNavigationBarColor(c);
        WindowInsetsControllerCompat ctl = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        ctl.setAppearanceLightStatusBars(!dark);
        ctl.setAppearanceLightNavigationBars(!dark);
        if (web != null) web.setBackgroundColor(dark ? c : Color.parseColor("#faf7f0"));
    }

    private class Bridge {
        @JavascriptInterface
        public void theme(String t) { runOnUiThread(() -> bars(t)); }

        /** Android share sheet (the WebView has no navigator.share). */
        @JavascriptInterface
        public void share(String text) {
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
            runOnUiThread(() -> startActivity(Intent.createChooser(i, null)));
        }

        @JavascriptInterface
        public void fullscreen() {
            runOnUiThread(() -> {
                full = !full;
                WindowInsetsControllerCompat ctl = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                ctl.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                if (full) ctl.hide(WindowInsetsCompat.Type.systemBars());
                else ctl.show(WindowInsetsCompat.Type.systemBars());
            });
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        // an open sheet closes first; only then does back leave the page
        web.evaluateJavascript("window.surahBack ? surahBack() : false", v -> {
            if ("true".equals(v)) return;
            if (web.canGoBack()) web.goBack();
            else finish();
        });
    }
}
