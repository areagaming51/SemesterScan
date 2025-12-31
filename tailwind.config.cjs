/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                slate: {
                    900: '#0f172a', // Deep background
                    800: '#1e293b', // Card background
                },
                indigo: {
                    400: '#818cf8', // Accents
                    600: '#4f46e5', // Buttons
                    800: '#3730a3', // Header
                }
            }
        }
    },
    plugins: [require('@tailwindcss/typography')]
};
