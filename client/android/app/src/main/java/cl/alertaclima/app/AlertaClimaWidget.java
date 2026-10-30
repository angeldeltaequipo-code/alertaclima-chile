package cl.alertaclima.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget «AlertaClima»: ZUMI, la temperatura de tu comuna y si hay alerta oficial.
 * Se dibuja con lo último que dejó la app y se actualiza solo cada 30 minutos
 * (Open-Meteo para el clima y nuestro servidor para las alertas).
 */
public class AlertaClimaWidget extends AppWidgetProvider {
    private static final String PREFS = "alertaclima_widget";
    private static final String CLAVE = "datos";

    static void guardarDatos(Context ctx, String datos) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(CLAVE, datos).apply();
    }

    static JSONObject leerDatos(Context ctx) {
        try {
            String s = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(CLAVE, null);
            return s == null ? null : new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    static void redibujarTodos(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        int[] ids = m.getAppWidgetIds(new ComponentName(ctx, AlertaClimaWidget.class));
        for (int id : ids) m.updateAppWidget(id, vista(ctx, leerDatos(ctx)));
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, vista(ctx, leerDatos(ctx)));
        // Actualiza en segundo plano (máximo ~10 s permitidos por Android).
        final PendingResult resultado = goAsync();
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            try {
                JSONObject d = leerDatos(app);
                if (d != null && refrescar(d)) {
                    guardarDatos(app, d.toString());
                    redibujarTodos(app);
                }
            } catch (Exception ignorado) {
                // Sin señal: queda lo último que se vio.
            } finally {
                resultado.finish();
            }
        }).start();
    }

    /** Consulta clima y alertas. Devuelve true si algo se actualizó. */
    static boolean refrescar(JSONObject d) throws Exception {
        boolean cambio = false;
        if (!d.isNull("lat") && !d.isNull("lng")) {
            String url = String.format(Locale.US,
                "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1",
                d.getDouble("lat"), d.getDouble("lng"));
            JSONObject c = new JSONObject(pedir(url));
            JSONObject actual = c.getJSONObject("current");
            d.put("temp", Math.round(actual.getDouble("temperature_2m")));
            d.put("texto", textoTiempo(actual.getInt("weather_code")));
            JSONObject diario = c.optJSONObject("daily");
            if (diario != null) {
                d.put("max", Math.round(diario.getJSONArray("temperature_2m_max").getDouble(0)));
                d.put("min", Math.round(diario.getJSONArray("temperature_2m_min").getDouble(0)));
            }
            cambio = true;
        }
        String api = d.optString("api", "");
        String cut = d.optString("cut", "");
        if (api.startsWith("https://") && !cut.isEmpty()) {
            JSONArray alertas = new JSONObject(pedir(api + "/api/alertas?comuna=" + cut)).getJSONArray("alertas");
            JSONObject peor = null;
            int gravedadPeor = 0;
            for (int i = 0; i < alertas.length(); i++) {
                JSONObject a = alertas.getJSONObject(i);
                if (a.optBoolean("sin_confirmar", false)) continue;
                int g = gravedad(a.optString("nivel"));
                if (g > gravedadPeor) {
                    gravedadPeor = g;
                    peor = a;
                }
            }
            if (peor == null) d.put("alerta", JSONObject.NULL);
            else {
                JSONObject al = new JSONObject();
                al.put("nivel", peor.optString("nivel"));
                al.put("titulo", tituloNivel(peor.optString("nivel")));
                al.put("amenaza", peor.optString("amenaza"));
                d.put("alerta", al);
            }
            cambio = true;
        }
        if (cambio) d.put("hora", System.currentTimeMillis());
        return cambio;
    }

    static String pedir(String direccion) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(direccion).openConnection();
        con.setConnectTimeout(4000);
        con.setReadTimeout(4000);
        try (BufferedReader r = new BufferedReader(new InputStreamReader(con.getInputStream(), "UTF-8"))) {
            StringBuilder sb = new StringBuilder();
            String linea;
            while ((linea = r.readLine()) != null) sb.append(linea);
            return sb.toString();
        } finally {
            con.disconnect();
        }
    }

    static int gravedad(String nivel) {
        switch (nivel) {
            case "preventiva": return 1;
            case "amarilla": return 2;
            case "roja": return 3;
            case "evacuacion": return 4;
            default: return 0;
        }
    }

    static String tituloNivel(String nivel) {
        switch (nivel) {
            case "preventiva": return "Alerta Temprana Preventiva";
            case "amarilla": return "Alerta Amarilla";
            case "roja": return "Alerta Roja";
            case "evacuacion": return "Evacuación";
            default: return "Alerta";
        }
    }

    static String textoTiempo(int c) {
        if (c == 0) return "Despejado";
        if (c <= 2) return "Parcialmente nublado";
        if (c == 3) return "Nublado";
        if (c == 45 || c == 48) return "Niebla";
        if (c >= 51 && c <= 57) return "Llovizna";
        if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return "Lluvia";
        if ((c >= 71 && c <= 77) || c == 85 || c == 86) return "Nieve";
        if (c >= 95) return "Tormenta";
        return "";
    }

    static RemoteViews vista(Context ctx, JSONObject d) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_alertaclima);
        Intent abrir = new Intent(ctx, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.widget_raiz, PendingIntent.getActivity(ctx, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        if (d == null) {
            v.setTextViewText(R.id.widget_comuna, "AlertaClima");
            v.setTextViewText(R.id.widget_temp, "");
            v.setTextViewText(R.id.widget_texto, "Abre la app y elige tu comuna");
            v.setViewVisibility(R.id.widget_alerta, View.GONE);
            v.setImageViewResource(R.id.widget_zumi, R.drawable.zumi_ok);
            return v;
        }
        JSONObject alerta = d.optJSONObject("alerta");
        v.setTextViewText(R.id.widget_comuna, d.optString("comuna", "Tu comuna"));
        v.setTextViewText(R.id.widget_temp, d.has("temp") ? d.optInt("temp") + "°" : "");
        String texto = d.optString("texto", "");
        if (!d.isNull("max") && !d.isNull("min")) texto += (texto.isEmpty() ? "" : " · ") + "Máx. " + d.optInt("max") + "° · Mín. " + d.optInt("min") + "°";
        v.setTextViewText(R.id.widget_texto, texto);
        v.setViewVisibility(R.id.widget_alerta, View.VISIBLE);
        if (alerta != null) {
            String nivel = alerta.optString("nivel");
            v.setTextViewText(R.id.widget_alerta, "⚠ " + alerta.optString("titulo") + (alerta.optString("amenaza").isEmpty() ? "" : ": " + alerta.optString("amenaza")));
            v.setInt(R.id.widget_alerta, "setBackgroundResource", "amarilla".equals(nivel) || "preventiva".equals(nivel) ? R.drawable.widget_alerta_amarilla : R.drawable.widget_alerta_roja);
            v.setTextColor(R.id.widget_alerta, "amarilla".equals(nivel) || "preventiva".equals(nivel) ? Color.parseColor("#2B2100") : Color.WHITE);
        } else {
            v.setTextViewText(R.id.widget_alerta, "✓ Sin alertas oficiales");
            v.setInt(R.id.widget_alerta, "setBackgroundResource", R.drawable.widget_alerta_ok);
            v.setTextColor(R.id.widget_alerta, Color.parseColor("#D7F5DF"));
        }
        v.setImageViewResource(R.id.widget_zumi, pose(d, alerta));
        return v;
    }

    static int pose(JSONObject d, JSONObject alerta) {
        if (alerta != null) return R.drawable.zumi_alerta;
        String t = d.optString("texto", "");
        if (t.contains("Lluvia") || t.contains("Llovizna") || t.contains("Tormenta") || t.contains("lluvia")) return R.drawable.zumi_paraguas;
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        if (h >= 21 || h < 6) return R.drawable.zumi_noche;
        if (d.optInt("temp", 0) >= 27) return R.drawable.zumi_verano;
        return R.drawable.zumi_ok;
    }
}
