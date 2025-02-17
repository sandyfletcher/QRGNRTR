// Validation Functions
function isValidEmail(email) {
    if (!email.trim()) return true; // empty email is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Formatting Functions
function formatVCard(name, phone, email, address) {
    let vCard = `BEGIN:VCARD\nVERSION:4.0\nFN:${name}`;
    
    if (phone.trim()) vCard += `\nTEL:${phone}`;
    if (email.trim()) vCard += `\nEMAIL:${email}`;
    if (address.trim()) vCard += `\nADR:${address}`;
    
    vCard += `\nEND:VCARD`;
    return vCard;
}

function formatWifiCode(ssid, password, hidden) {
    let security = password.trim() ? 'WPA' : 'nopass';
    return `WIFI:S:${ssid};T:${security};P:${password};H:${hidden};`;
}

// UI Update Functions
function updateFooterMessage(message) {
    document.getElementById('footer-message').innerHTML = message;
}

function initializeNetworkVisibility() {
    const toggleBox = document.getElementById('network-visibility');
    const hiddenInput = document.getElementById('wifi-hidden');
    
    if (!toggleBox || !hiddenInput) return;
    
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

function switchInputArea(selectedTab) {
    const linkTextInput = document.getElementById('text-input');
    const contactInfoInputs = document.getElementById('contact-info-inputs');
    const wifiCodeInputs = document.getElementById('wifi-code-inputs');
    
    // Hide all inputs
    linkTextInput.style.display = 'none';
    contactInfoInputs.style.display = 'none';
    wifiCodeInputs.style.display = 'none';

    // Show selected input
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

// QR Code Generation Function
function generateQRCode(qrText, container) {
    // Clear existing content
    container.innerHTML = '';
    container.classList.add('loading');

    // Remove placeholder image if it exists
    const placeholder = container.querySelector('.placeholder-image');
    if (placeholder) {
        placeholder.remove();
    }

    // Create a hidden wrapper for the QR code
    const qrWrapper = document.createElement('div');
    qrWrapper.style.opacity = '0';
    qrWrapper.style.transition = 'opacity 0.3s ease-in';
    container.appendChild(qrWrapper);

    // Generate QR code in the wrapper
    new QRCode(qrWrapper, {
        text: qrText,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
        quietZone: 16,
        quietZoneColor: "#ffffff"
    });

    // Process the QR code image
    const qrImage = qrWrapper.querySelector('img');
    qrImage.onload = function() {
        const canvas = document.createElement('canvas');
        const padding = 32;
        canvas.width = qrImage.width + (padding * 2);
        canvas.height = qrImage.height + (padding * 2);
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(qrImage, padding, padding);
        
        // Create padded image
        const paddedImage = new Image();
        paddedImage.style.opacity = '0';
        paddedImage.style.width = '256px';
        paddedImage.style.height = '256px';
        paddedImage.style.transform = 'scale(0.95)';
        paddedImage.style.transition = 'opacity 0.3s ease-in, transform 0.3s ease-out';
        
        // Show the padded image once loaded
        paddedImage.onload = function() {
            qrWrapper.remove();
            container.appendChild(paddedImage);
            
            requestAnimationFrame(() => {
                container.classList.remove('loading');
                paddedImage.style.opacity = '1';
                paddedImage.style.transform = 'scale(1)';
            });
        };
        
        paddedImage.src = canvas.toDataURL('image/png');
    };
}

// Main Initialization
document.addEventListener('DOMContentLoaded', function() {
    const generateButton = document.getElementById('generate-button');
    const container = document.getElementById('qr-container');

    // Initialize tab switching
    document.querySelectorAll('input[name="tab"]').forEach(radio => {
        radio.addEventListener('change', function() {
            switchInputArea(this.value);
        });
    });

    // Initialize page
    switchInputArea(document.querySelector('input[name="tab"]:checked').value);
    initializeNetworkVisibility();

    // Handle QR code generation
    generateButton.addEventListener('click', function() {
        const selectedTab = document.querySelector('input[name="tab"]:checked').value;
        let qrText = "";
        const maxLength = 1000;

        try {
            switch (selectedTab) {
                case 'text':
                    const textInput = document.getElementById('text-input').value.trim();
                    if (!textInput) {
                        throw new Error("Please enter some text or a URL to generate a QR code.");
                    }
                    if (textInput.length > maxLength) {
                        throw new Error(`Input text exceeds the maximum length of ${maxLength} characters.`);
                    }
                    qrText = textInput;
                    break;

                case 'contact-info':
                    const name = document.getElementById('contact-name').value.trim();
                    const phone = document.getElementById('contact-phone').value.trim();
                    const email = document.getElementById('contact-email').value.trim();
                    const address = document.getElementById('contact-address').value.trim();

                    if (!name && !phone && !email && !address) {
                        throw new Error("Please enter at least one piece of contact information.");
                    }

                    if (name.length > 100 || phone.length > 20 || email.length > 100 || address.length > 200) {
                        throw new Error("One or more fields exceed the maximum length.");
                    }

                    if (!isValidEmail(email)) {
                        throw new Error("Email must be in the format (name)@(domain).(tld)");
                    }

                    qrText = formatVCard(name, phone, email, address);
                    break;

                case 'wifi-code':
                    const ssid = document.getElementById('wifi-ssid').value;
                    const password = document.getElementById('wifi-password').value;
                    const hidden = document.getElementById('wifi-hidden').value === 'true';
                
                    if (!ssid) {
                        throw new Error("Please enter the network name (SSID).");
                    }
                
                    if (ssid.length > 32 || password.length > 64) {
                        throw new Error("SSID or Password exceeds the maximum length.");
                    }
                
                    qrText = formatWifiCode(ssid, password, hidden);
                    break;
            }

            generateQRCode(qrText, container);
            updateFooterMessage("QR Code Generated!");

        } catch (error) {
            updateFooterMessage(error.message);
            console.error("QR Code generation error:", error);
            container.classList.remove('loading');
        }
    });

    // Set initial footer message
    updateFooterMessage('<a href="https://sandyfletcher.ca" style="color: white; text-decoration: none;">site by sandy</a>');
});