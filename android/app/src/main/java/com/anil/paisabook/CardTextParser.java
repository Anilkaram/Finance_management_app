package com.anil.paisabook;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pulls card fields out of raw OCR lines. Kept free of Android types so it can be reasoned
 * about (and unit-tested) on its own.
 */
final class CardTextParser {

    private CardTextParser() {}

    /** Card number: 13-19 digits that satisfy the Luhn checksum. */
    static String findPan(List<String> lines) {
        for (String line : lines) {
            String digits = line.replaceAll("[^0-9]", "");
            if (digits.length() >= 13 && digits.length() <= 19 && luhn(digits)) {
                return digits;
            }
            // OCR sometimes glues the number to neighbouring digits (expiry, CVV printed inline).
            // Slide a window over the run and take the first stretch that checksums.
            if (digits.length() > 19) {
                for (int width = 16; width >= 13; width--) {
                    for (int i = 0; i + width <= digits.length(); i++) {
                        String window = digits.substring(i, i + width);
                        if (luhn(window)) {
                            return window;
                        }
                    }
                }
            }
        }
        return null;
    }

    static boolean luhn(String digits) {
        int sum = 0;
        boolean doubling = false;
        for (int i = digits.length() - 1; i >= 0; i--) {
            int n = digits.charAt(i) - '0';
            if (n < 0 || n > 9) {
                return false;
            }
            if (doubling) {
                n *= 2;
                if (n > 9) {
                    n -= 9;
                }
            }
            sum += n;
            doubling = !doubling;
        }
        return sum % 10 == 0;
    }

    /** Issuing network from the leading digits. RuPay ranges take priority for Indian cards. */
    static String network(String pan) {
        if (pan == null || pan.length() < 4) {
            return "";
        }
        int two = Integer.parseInt(pan.substring(0, 2));
        int four = Integer.parseInt(pan.substring(0, 4));

        if (pan.startsWith("508") || pan.startsWith("606") || pan.startsWith("607")
                || pan.startsWith("608") || pan.startsWith("652") || pan.startsWith("653")
                || pan.startsWith("817") || pan.startsWith("818") || pan.startsWith("819")) {
            return "RuPay";
        }
        if (pan.startsWith("4")) {
            return "Visa";
        }
        if (two >= 51 && two <= 55) {
            return "Mastercard";
        }
        if (four >= 2221 && four <= 2720) {
            return "Mastercard";
        }
        if (two == 34 || two == 37) {
            return "Amex";
        }
        if (two == 36 || two == 38 || pan.startsWith("300") || pan.startsWith("305")) {
            return "Diners Club";
        }
        if (two == 35) {
            return "JCB";
        }
        if (two == 62) {
            return "UnionPay";
        }
        if (two == 65 || pan.startsWith("6011")) {
            return "Discover";
        }
        return "";
    }

    private static final Pattern EXPIRY = Pattern.compile("(0[1-9]|1[0-2])\\s*[/\\-]\\s*(\\d{2})(?!\\d)");

    /**
     * Expiry as MM/YY. A card can carry both "MEMBER SINCE" and "VALID THRU"; the later date
     * is the expiry, so take the highest plausible one.
     */
    static String findExpiry(List<String> lines) {
        String best = null;
        int bestScore = -1;
        for (String line : lines) {
            Matcher m = EXPIRY.matcher(line);
            while (m.find()) {
                int month = Integer.parseInt(m.group(1));
                int year = Integer.parseInt(m.group(2));
                if (year < 20 || year > 45) {
                    continue;
                }
                int score = year * 12 + month;
                if (score > bestScore) {
                    bestScore = score;
                    best = m.group(1) + "/" + m.group(2);
                }
            }
        }
        return best;
    }
}
