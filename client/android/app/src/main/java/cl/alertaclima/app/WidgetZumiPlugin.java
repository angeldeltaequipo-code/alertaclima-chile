package cl.alertaclima.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Recibe desde la app el resumen del clima y la alerta, y redibuja el widget. */
@CapacitorPlugin(name = "WidgetZumi")
public class WidgetZumiPlugin extends Plugin {
    @PluginMethod
    public void guardar(PluginCall call) {
        String datos = call.getString("datos");
        if (datos == null || datos.length() > 4000) {
            call.reject("Datos inválidos");
            return;
        }
        AlertaClimaWidget.guardarDatos(getContext(), datos);
        AlertaClimaWidget.redibujarTodos(getContext());
        call.resolve(new JSObject());
    }
}
