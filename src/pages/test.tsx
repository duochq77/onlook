// src/pages/test.tsx

import { useEffect } from 'react'
import { useRouter } from 'next/router'

const TestRedirectPage = () => {
    const router = useRouter()

    useEffect(() => {
        router.push('/seller/devVideoSingleFile') // điều hướng tới file test mới
    }, [router])

    return <p>🔁 Đang điều hướng tới devVideoSingleFile.tsx...</p>
}

export default TestRedirectPage
