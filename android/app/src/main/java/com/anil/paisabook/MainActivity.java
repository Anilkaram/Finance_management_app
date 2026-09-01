package com.anil.paisabook;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CardScannerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
