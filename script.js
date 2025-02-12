// Function to validate URL format
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Function to validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Function to format contact info into a vCard
function formatVCard(name, phone, email, address) {
    let vCard = `BEGIN:VCARD
VERSION:4.0
FN:${name}
TEL:${phone}
EMAIL:${email}
ADR:${address}
END:VCARD`;
    return vCard;
}

// Function to format WiFi info into a WiFi code string
function formatWifiCode(ssid, password, hidden, noPassword) {
    let security = (noPassword) ? 'nopass' : 'WPA'; // Default to WPA if password provided
    return `WIFI:S:${ssid};T:${security};P:${password};H:${hidden};`;
}

// Function to update the footer message
function updateFooterMessage(message) {
    document.getElementById('footer-message').innerHTML = message; // Use innerHTML
}

document.addEventListener('DOMContentLoaded', function() {
    const linkTextInput = document.getElementById('link-text-input');
    const contactInfoInputs = document.getElementById('contact-info-inputs');
    const wifiCodeInputs = document.getElementById('wifi-code-inputs'); // Corrected ID
    const generateButton = document.getElementById('generate-button');
    const qrcodeDiv = document.getElementById('qrcode');
    const qrCodeImageWidth = 256; // Define the initial QR code image size (used until an image is generated)

    // Function to switch between input areas
    function switchInputArea(selectedTab) {
        linkTextInput.style.display = 'none';
        contactInfoInputs.style.display = 'none';
        wifiCodeInputs.style.display = 'none'; // Corrected ID

        switch (selectedTab) {
            case 'link-text':
                linkTextInput.style.display = 'block';
                break;
            case 'contact-info':
                contactInfoInputs.style.display = 'block';
                break;
            case 'wifi-code':
                wifiCodeInputs.style.display = 'block'; // Corrected ID
                break;
        }
    }

    // Event listener for tab changes
    document.querySelectorAll('input[name="tab"]').forEach(radio => {
        radio.addEventListener('change', function() {
            switchInputArea(this.value);
        });
    });

    generateButton.addEventListener('click', function() {
        let selectedTab = document.querySelector('input[name="tab"]:checked').value;
        let qrText = "";
        const maxLength = 1000; // Define your maximum length
        const paddingPercentage = 0.10;

        switch (selectedTab) {
            case 'link-text':
                qrText = linkTextInput.value;
                if (qrText.length > maxLength) {
                    updateFooterMessage(`Input text exceeds the maximum length of ${maxLength} characters.`);
                    return; // Stop QR code generation
                }
                if (qrText.startsWith('http://') || qrText.startsWith('https://')) {
                    if (!isValidURL(qrText)) {
                        updateFooterMessage("Invalid URL. Please enter a valid URL.");
                        return;
                    }
                }
                break;
            case 'contact-info':
                const name = document.getElementById('contact-name').value;
                const phone = document.getElementById('contact-phone').value;
                const email = document.getElementById('contact-email').value;
                const address = document.getElementById('contact-address').value;

                if (name.length > 100 || phone.length > 20 || email.length > 100 || address.length > 200) {
                  updateFooterMessage(`One or more contact information fields exceed the maximum length.`);
                  return;
                }

                if (!isValidEmail(email)) {
                    updateFooterMessage("Email must be in the format name@domain.tld");
                    return;
                }
                qrText = formatVCard(name, phone, email, address);
                break;
            case 'wifi-code':
                const ssid = document.getElementById('wifi-ssid').value;
                const password = document.getElementById('wifi-password').value;
                const hidden = document.getElementById('wifi-hidden').checked;  // Get boolean value
                const noPassword = document.getElementById('wifi-nopass').checked;  // Get boolean value

                if (ssid.length > 32 || password.length > 64) {
                    updateFooterMessage(`SSID or Password exceeds the maximum length.`);
                    return;
                }

                if (password === "" && !noPassword) {
                    updateFooterMessage("Please enter a password, or check the 'Open (No Password)' box if the network is open.");
                    return;
                }

                qrText = formatWifiCode(ssid, password, hidden, noPassword);
                break;
        }

        // QR Code Generation
        try {
            qrcodeDiv.innerHTML = ''; // Clear previous QR code

            let qrcode = new QRCode(qrcodeDiv, {
                text: qrText,
                width: qrCodeImageWidth,
                height: qrCodeImageWidth,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H,
                drawBackgroundColor: true //New parameter
            });
        
            // Calculate the width of the container with padding:
            const containerWidth = qrCodeImageWidth + (qrCodeImageWidth * paddingPercentage * 2);
            const containerHeight = containerWidth; // Height is the same as the width

            // Set the width of the qrcodeDiv:
            qrcodeDiv.style.width = `${containerWidth}px`;
            qrcodeDiv.style.height = `${containerHeight}px`;

            updateFooterMessage("QR Code Generated!"); // Update footer on success

        } catch (error) {
            updateFooterMessage("Error generating QR code: " + error.message); // Use footer for errors
            console.error("QR Code generation error:", error);
        }
    });

    // Initialize the correct input area on page load
    switchInputArea(document.querySelector('input[name="tab"]:checked').value);

        // Set initial width of the qrcodeDiv (before any code is generated)
        const initialContainerWidth = qrCodeImageWidth + (qrCodeImageWidth * 0.10 * 2);
        qrcodeDiv.style.width = `${initialContainerWidth}px`;
        qrcodeDiv.style.height = `${initialContainerWidth}px`;

    // Initial footer message
    updateFooterMessage('<a href="https://sandyfletcher.ca" style="color: white; text-decoration: none;">site by sandy</a>');
});