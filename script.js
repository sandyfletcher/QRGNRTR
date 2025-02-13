// validate email only if it's not empty
function isValidEmail(email) {
    if (!email.trim()) return true; // empty email is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// format contact info to vCard
function formatVCard(name, phone, email, address) {
    let vCard = `BEGIN:VCARD\nVERSION:4.0\nFN:${name}`;
    if (phone.trim()) vCard += `\nTEL:${phone}`;
    if (email.trim()) vCard += `\nEMAIL:${email}`;
    if (address.trim()) vCard += `\nADR:${address}`;
    vCard += `\nEND:VCARD`;
    return vCard;
}

// format WiFi info
function formatWifiCode(ssid, password, hidden, noPassword) {
    let security = (noPassword) ? 'nopass' : 'WPA';
    return `WIFI:S:${ssid};T:${security};P:${password};H:${hidden};`;
}

// function to update footer message
function updateFooterMessage(message) {
    document.getElementById('footer-message').innerHTML = message;
}

// main function
document.addEventListener('DOMContentLoaded', function() {
    const linkTextInput = document.getElementById('text-input');
    const contactInfoInputs = document.getElementById('contact-info-inputs');
    const wifiCodeInputs = document.getElementById('wifi-code-inputs');
    const generateButton = document.getElementById('generate-button');
    const qrcodeDiv = document.getElementById('qrcode');
    const qrCodeImageWidth = 256;
    const qrContainer = document.getElementById('qr-container');
    const qrPlaceholder = document.getElementById('qr-placeholder');
    const qrCodeImage = document.getElementById('qr-code-image');

    // switch between input areas
    function switchInputArea(selectedTab) {
        linkTextInput.style.display = 'none';
        contactInfoInputs.style.display = 'none';
        wifiCodeInputs.style.display = 'none';

        switch (selectedTab) {
            case 'text':
                linkTextInput.style.display = 'block';
                break;
            case 'contact-info':
                contactInfoInputs.style.display = 'flex';
                break;
            case 'wifi-code':
                wifiCodeInputs.style.display = 'flex';
                break;
        }
    }

    // listener for tab changes
    document.querySelectorAll('input[name="tab"]').forEach(radio => {
        radio.addEventListener('change', function() {
            switchInputArea(this.value);
        });
    });

    // QRcode generation
    generateButton.addEventListener('click', function() {
        let selectedTab = document.querySelector('input[name="tab"]:checked').value;
        let qrText = "";
        const maxLength = 1000;

        switch (selectedTab) {
            case 'text':
                qrText = linkTextInput.value.trim();
                if (!qrText) {
                    updateFooterMessage("Please enter some text or a URL to generate a QR code.");
                    return;
                }
                if (qrText.length > maxLength) {
                    updateFooterMessage(`Input text exceeds the maximum length of ${maxLength} characters.`);
                    return;
                }
                break;

            case 'contact-info':
                const name = document.getElementById('contact-name').value.trim();
                const phone = document.getElementById('contact-phone').value.trim();
                const email = document.getElementById('contact-email').value.trim();
                const address = document.getElementById('contact-address').value.trim();

                if (!name && !phone && !email && !address) {
                    updateFooterMessage("Please enter at least one piece of contact information.");
                    return;
                }

                if (name.length > 100 || phone.length > 20 || email.length > 100 || address.length > 200) {
                    updateFooterMessage(`One or more fields exceed the maximum length.`);
                    return;
                }

                if (!isValidEmail(email)) {
                    updateFooterMessage("Email must be in the format (name)@(domain).(tld)");
                    return;
                }

                qrText = formatVCard(name, phone, email, address);
                break;

            case 'wifi-code':
                const ssid = document.getElementById('wifi-ssid').value;
                const password = document.getElementById('wifi-password').value;
                const hidden = document.getElementById('wifi-hidden').checked;
                const noPassword = document.getElementById('wifi-nopass').checked;

                if (!ssid) {
                    updateFooterMessage("Please enter the network name (SSID).");
                    return;
                }

                if (ssid.length > 32 || password.length > 64) {
                    updateFooterMessage(`SSID or Password exceeds the maximum length.`);
                    return;
                }

                if (password === "" && !noPassword) {
                    updateFooterMessage("Please enter the password or check the box if network is open.");
                    return;
                }

                qrText = formatWifiCode(ssid, password, hidden, noPassword);
                break;
        }

        try {
            // Create offscreen canvas
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = qrCodeImageWidth;
            offscreenCanvas.height = qrCodeImageWidth;

            // Generate QR code on the offscreen canvas
            let qrcode = new QRCode(offscreenCanvas, {
                text: qrText,
                width: qrCodeImageWidth,
                height: qrCodeImageWidth,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H,
                drawBackgroundColor: true
            });

            // Reset for transition
            qrCodeImage.classList.remove('loaded');

            // Wait for image creation and then pad
            const checkImage = setInterval(() => {
                const img = offscreenCanvas.querySelector('img');
                if (img) {
                    clearInterval(checkImage);
                    
                    // Create a new canvas with the same dimensions as the QR container
                    const canvas = document.createElement('canvas');
                    const containerWidth = qrContainer.clientWidth;
                    const paddingSize = Math.floor(containerWidth * 0.0625);
                    
                    canvas.width = containerWidth;
                    canvas.height = containerWidth;

                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    // Scale the QR code to fit the container while maintaining padding
                    const qrSize = containerWidth - (paddingSize * 2);
                    ctx.drawImage(img, paddingSize, paddingSize, qrSize, qrSize);

                    const paddedImage = new Image();
                    paddedImage.onload = () => {
                        qrCodeImage.classList.add('loaded');
                    };

                    paddedImage.src = canvas.toDataURL('image/png');
                    qrCodeImage.src = paddedImage.src;
                    updateFooterMessage("QR Code Generated!");
                }
            }, 50);
    
        } catch (error) {
            // Reset the display on error
            qrCodeImage.classList.remove('loaded');
            updateFooterMessage("Error generating QR code: " + error.message);
            console.error("QR Code generation error:", error);
        }
    });

    // Initialize the correct input area on page load
    switchInputArea(document.querySelector('input[name="tab"]:checked').value);

    // Initial footer message
    updateFooterMessage('<a href="https://sandyfletcher.ca" style="color: white; text-decoration: none;">site by sandy</a>');
});