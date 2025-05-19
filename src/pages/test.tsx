// src/pages/test.tsx

import { useEffect } from 'react';
import { useRouter } from 'next/router';

const TestRedirectPage = () => {
    const router = useRouter();

    useEffect(() => {
        router.push('/seller/devVideoSingleFile'); // ✅ Điều hướng tới file mới
    }, [router]);

    return <p>🔁 Đang chuyển hướng tới bản test devVideoSingleFile.tsx...</p>;
};

export default TestRedirectPage;
