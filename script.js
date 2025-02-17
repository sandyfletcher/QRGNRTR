// validate email if not empty
function isValidEmail(email) {
    if (!email.trim()) return true; // empty email is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// format contact info
function formatVCard(name, phone, email, address) {
    let vCard = `BEGIN:VCARD\nVERSION:4.0\nFN:${name}`;
    if (phone.trim()) vCard += `\nTEL:${phone}`;
    if (email.trim()) vCard += `\nEMAIL:${email}`;
    if (address.trim()) vCard += `\nADR:${address}`;
    vCard += `\nEND:VCARD`;
    return vCard;
}

// format WiFi info
function formatWifiCode(ssid, password, hidden) {
    let security = password.trim() ? 'WPA' : 'nopass';
    return `WIFI:S:${ssid};T:${security};P:${password};H:${hidden};`;
}

// update footer message
function updateFooterMessage(message) {
    document.getElementById('footer-message').innerHTML = message;
}

// Initialize network visibility toggle
function initializeNetworkVisibility() {
    const toggleBox = document.getElementById('network-visibility');
    const hiddenInput = document.getElementById('wifi-hidden');
    
    if (!toggleBox || !hiddenInput) return; // Guard clause if elements don't exist
    
    toggleBox.addEventListener('click', function() {
        const isHidden = toggleBox.getAttribute('aria-pressed') === 'true';
        toggleBox.setAttribute('aria-pressed', (!isHidden).toString());
        toggleBox.textContent = isHidden ? 'Network: Visible' : 'Network: Hidden';
        hiddenInput.value = (!isHidden).toString();
    });

    // Make it keyboard accessible
    toggleBox.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
        }
    });
}

// Switch between input areas
function switchInputArea(selectedTab) {
    const linkTextInput = document.getElementById('text-input');
    const contactInfoInputs = document.getElementById('contact-info-inputs');
    const wifiCodeInputs = document.getElementById('wifi-code-inputs');
    
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

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
    const linkTextInput = document.getElementById('text-input');
    const contactInfoInputs = document.getElementById('contact-info-inputs');
    const wifiCodeInputs = document.getElementById('wifi-code-inputs');
    const generateButton = document.getElementById('generate-button');

    // Initialize tab switching
    document.querySelectorAll('input[name="tab"]').forEach(radio => {
        radio.addEventListener('change', function() {
            switchInputArea(this.value);
        });
    });

    // Initialize the correct input area and network visibility on page load
    switchInputArea(document.querySelector('input[name="tab"]:checked').value);
    initializeNetworkVisibility();

    // QR generation
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
                const hidden = document.getElementById('wifi-hidden').value === 'true';
            
                if (!ssid) {
                    updateFooterMessage("Please enter the network name (SSID).");
                    return;
                }
            
                if (ssid.length > 32 || password.length > 64) {
                    updateFooterMessage(`SSID or Password exceeds the maximum length.`);
                    return;
                }
            
                qrText = formatWifiCode(ssid, password, hidden);
                break;
        }

        try {
            // Clear any existing content
            const container = document.getElementById('qr-container');
            container.innerHTML = '';
            container.classList.add('loading');

            // Remove placeholder image if it exists
            const placeholder = container.querySelector('.placeholder-image');
            if (placeholder) {
                placeholder.remove();
            }

            // Generate QR code
            new QRCode(container, {
                text: qrText,
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H,
                quietZone: 16,
                quietZoneColor: "#ffffff"
            });

            // Get the generated QR code image
            const qrImage = container.querySelector('img');
            
            // Process the image once loaded
            qrImage.onload = function() {
                const canvas = document.createElement('canvas');
                const padding = 32;
                canvas.width = qrImage.width + (padding * 2);
                canvas.height = qrImage.height + (padding * 2);
                
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(qrImage, padding, padding);
                
                // Create new image with padding
                const paddedImage = new Image();
                paddedImage.style.opacity = '0';
                paddedImage.style.width = '256px';
                paddedImage.style.height = '256px';
                
                // Add the image to DOM before changing source
                container.innerHTML = '';
                container.appendChild(paddedImage);
                
                // Small delay to ensure CSS transition works
                setTimeout(() => {
                    paddedImage.onload = function() {
                        paddedImage.style.opacity = '1';
                        container.classList.remove('loading');
                    };
                    paddedImage.src = canvas.toDataURL('image/png');
                }, 50);
            };

            updateFooterMessage("QR Code Generated!");
        } catch (error) {
            updateFooterMessage("Error generating QR code: " + error.message);
            console.error("QR Code generation error:", error);
            container.classList.remove('loading');
        }
    });

    // Initial footer message
    updateFooterMessage('<a href="https://sandyfletcher.ca" style="color: white; text-decoration: none;">site by sandy</a>');
});