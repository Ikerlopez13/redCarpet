package com.vibecode.redcarpet;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(CallPhonePlugin.class);
        registerPlugin(LocationAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
