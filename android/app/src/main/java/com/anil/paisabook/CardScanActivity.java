package com.anil.paisabook;

import android.app.Activity;
import android.content.Intent;
import android.media.Image;
import android.os.Bundle;
import android.util.Log;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ExperimentalGetImage;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Live card scanner. Runs ML Kit's bundled Latin text recogniser over the camera stream and
 * looks for a Luhn-valid card number and an expiry date.
 *
 * The scanned number is returned so the card screen can store it. It is validated here
 * (Luhn + agreement across frames) and never written to disk or logged by this activity.
 */
@OptIn(markerClass = ExperimentalGetImage.class)
public class CardScanActivity extends AppCompatActivity {

    static final String EXTRA_NUMBER = "number";
    static final String EXTRA_LAST4 = "last4";
    static final String EXTRA_NETWORK = "network";
    static final String EXTRA_EXPIRY = "expiry";

    private static final String TAG = "CardScan";
    /** Number of consecutive frames that must agree before we accept a read. */
    private static final int CONFIRMATIONS_REQUIRED = 2;

    private PreviewView previewView;
    private TextView statusText;
    private ExecutorService analysisExecutor;
    private TextRecognizer recognizer;

    private String candidatePan;
    private int candidateHits;
    private String seenExpiry;
    /** Written on the recogniser callback thread, read on the camera analysis thread. */
    private volatile boolean finished;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_card_scan);

        previewView = findViewById(R.id.preview);
        statusText = findViewById(R.id.status);
        findViewById(R.id.cancel).setOnClickListener(v -> {
            setResult(Activity.RESULT_CANCELED);
            finish();
        });

        analysisExecutor = Executors.newSingleThreadExecutor();
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

        startCamera();
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
        future.addListener(() -> {
            try {
                ProcessCameraProvider provider = future.get();

                Preview preview = new Preview.Builder().build();
                preview.setSurfaceProvider(previewView.getSurfaceProvider());

                ImageAnalysis analysis = new ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build();
                analysis.setAnalyzer(analysisExecutor, this::analyze);

                provider.unbindAll();
                provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis);
            } catch (Exception e) {
                Log.e(TAG, "Camera start failed", e);
                runOnUiThread(() -> statusText.setText(R.string.scan_camera_error));
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void analyze(@NonNull ImageProxy proxy) {
        if (finished) {
            proxy.close();
            return;
        }
        Image media = proxy.getImage();
        if (media == null) {
            proxy.close();
            return;
        }

        InputImage image = InputImage.fromMediaImage(media, proxy.getImageInfo().getRotationDegrees());
        recognizer.process(image)
                .addOnSuccessListener(this::onText)
                .addOnFailureListener(e -> Log.e(TAG, "Recognition failed", e))
                .addOnCompleteListener(t -> proxy.close());
    }

    private void onText(Text text) {
        if (finished) {
            return;
        }

        List<String> lines = new ArrayList<>();
        for (Text.TextBlock block : text.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                lines.add(line.getText());
            }
        }
        if (lines.isEmpty()) {
            return;
        }

        String expiry = CardTextParser.findExpiry(lines);
        if (expiry != null) {
            seenExpiry = expiry;
        }

        String pan = CardTextParser.findPan(lines);
        if (pan == null) {
            return;
        }

        if (pan.equals(candidatePan)) {
            candidateHits++;
        } else {
            candidatePan = pan;
            candidateHits = 1;
        }

        String network = CardTextParser.network(pan);
        String last4 = pan.substring(pan.length() - 4);

        if (candidateHits < CONFIRMATIONS_REQUIRED) {
            runOnUiThread(() -> statusText.setText(getString(R.string.scan_holding, last4)));
            return;
        }

        finished = true;
        Intent data = new Intent();
        data.putExtra(EXTRA_NUMBER, pan);
        data.putExtra(EXTRA_LAST4, last4);
        data.putExtra(EXTRA_NETWORK, network);
        data.putExtra(EXTRA_EXPIRY, seenExpiry);

        runOnUiThread(() -> {
            statusText.setText(getString(R.string.scan_got_it, last4));
            setResult(Activity.RESULT_OK, data);
            previewView.postDelayed(this::finish, 350);
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (analysisExecutor != null) {
            analysisExecutor.shutdown();
        }
        if (recognizer != null) {
            recognizer.close();
        }
    }
}
