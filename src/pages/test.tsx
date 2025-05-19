// src/pages/test.tsx

import { useEffect } from 'react'
import { useRouter } from 'next/router'

const TestRedirectPage = () => {
    const router = useRouter()

    useEffect(() => {
        // Chuyển hướng đến trang đang cần test
        router.push('/seller/videoSingleFile')
    }, [router])

    return <p>Đang chuyển hướng tới /seller/videoSingleFile...</p>
}

export default TestRedirectPage
