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
    const wifiCodeInputs = document.getElementById('wifi-code-inputs');
    const generateButton = document.getElementById('generate-button');
    const qrcodeDiv = document.getElementById('qrcode');
    const qrCodeImageWidth = 256;

    // Create a permanent container for QR codes that will persist
    const permanentContainer = document.createElement('div');
    permanentContainer.style.width = `${qrCodeImageWidth}px`;
    permanentContainer.style.height = `${qrCodeImageWidth}px`;
    permanentContainer.style.display = 'inline-block';

    // Create and add the placeholder image
    const placeholderImage = document.createElement('img');
    placeholderImage.src = 'assets/smile.png';
    placeholderImage.style.width = '100%';
    placeholderImage.style.height = '100%';
    placeholderImage.style.objectFit = 'contain';
    permanentContainer.appendChild(placeholderImage);
    
    qrcodeDiv.appendChild(permanentContainer);

    // Remove any padding from qrcodeDiv
    qrcodeDiv.style.padding = '0';
    qrcodeDiv.style.backgroundColor = 'transparent';
    qrcodeDiv.style.border = 'none';

    // Function to switch between input areas
    function switchInputArea(selectedTab) {
        linkTextInput.style.display = 'none';
        contactInfoInputs.style.display = 'none';
        wifiCodeInputs.style.display = 'none';

        switch (selectedTab) {
            case 'link-text':
                linkTextInput.style.display = 'block';
                break;
            case 'contact-info':
                contactInfoInputs.style.display = 'flex';  // Changed to 'flex'
                break;
            case 'wifi-code':
                wifiCodeInputs.style.display = 'flex';  // Changed to 'flex'
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
        const maxLength = 1000;

        switch (selectedTab) {
            case 'link-text':
                qrText = linkTextInput.value;
                if (qrText.length > maxLength) {
                    updateFooterMessage(`Input text exceeds the maximum length of ${maxLength} characters.`);
                    return;
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
                const hidden = document.getElementById('wifi-hidden').checked;
                const noPassword = document.getElementById('wifi-nopass').checked;

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
            permanentContainer.innerHTML = ''; // Clear the placeholder image
            
            // Create the QR code container
            const qrContainer = document.createElement('div');
            qrContainer.style.backgroundColor = '#ffffff';
            qrContainer.style.width = '100%';
            qrContainer.style.height = '100%';
            
            // Add it to our permanent container
            permanentContainer.appendChild(qrContainer);

            let qrcode = new QRCode(qrContainer, {
                text: qrText,
                width: qrCodeImageWidth,
                height: qrCodeImageWidth,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H,
                drawBackgroundColor: true
            });

            // Add event listener for when image is created
            const checkImage = setInterval(() => {
                const img = qrContainer.querySelector('img');
                if (img) {
                    clearInterval(checkImage);
                    
                    // Create a canvas to manipulate the image
                    const canvas = document.createElement('canvas');
                    const paddingSize = 16;
                    canvas.width = img.width + (paddingSize * 2);
                    canvas.height = img.height + (paddingSize * 2);
                    
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, paddingSize, paddingSize);
                    
                    const paddedImage = new Image();
                    paddedImage.src = canvas.toDataURL('image/png');
                    paddedImage.style.display = 'block';
                    paddedImage.style.width = '100%';
                    paddedImage.style.height = '100%';
                    paddedImage.style.objectFit = 'contain';
                    
                    qrContainer.innerHTML = '';
                    qrContainer.appendChild(paddedImage);
                }
            }, 50);

            updateFooterMessage("QR Code Generated!");
        } catch (error) {
            // If there's an error, show the placeholder image again
            permanentContainer.innerHTML = '';
            permanentContainer.appendChild(placeholderImage);
            updateFooterMessage("Error generating QR code: " + error.message);
            console.error("QR Code generation error:", error);
        }
    });
    
    // Initialize the correct input area on page load
    switchInputArea(document.querySelector('input[name="tab"]:checked').value);

    // Initial footer message
    updateFooterMessage('<a href="https://sandyfletcher.ca" style="color: white; text-decoration: none;">site by sandy</a>');
});