import withPWAInit from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    turbopack: {},
};

const withPWA = withPWAInit({
    dest: "public",
    disable: process.env.NODE_ENV === "development", // Disable PWA in development to prevent caching issues
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    swcMinify: true,
    workboxOptions: {
        disableDevLogs: true,
    },
});

export default withPWA(nextConfig);
