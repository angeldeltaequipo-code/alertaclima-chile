package cl.alertaclima.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Puente con el widget de la pantalla de inicio (se registra antes de crear la app).
        registerPlugin(WidgetZumiPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
