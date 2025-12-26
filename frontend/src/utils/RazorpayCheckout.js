/**
 * Utility to handle Razorpay payment integration
 */

export const loadRazorpayScript = () => {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

export const initiateRazorpayPayment = async (options) => {
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
        alert('Razorpay SDK failed to load. Are you online?');
        return;
    }

    const rzp = new window.Razorpay(options);
    rzp.open();
    
    rzp.on('payment.failed', function (response){
        console.error("Payment Failed", response.error);
        alert(`Payment Failed: ${response.error.description}`);
    });
};
