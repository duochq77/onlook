// 06. src/components/Player.tsx

import React from 'react'

interface PlayerProps {
    fileUrl: string
    type: 'video' | 'audio'
}

const Player: React.FC<PlayerProps> = ({ fileUrl, type }) => {
    if (!fileUrl) return null

    return (
        <div className="mt-4">
            {type === 'video' ? (
                <video src={fileUrl} controls className="w-full rounded-lg shadow-md" />
            ) : (
                <audio src={fileUrl} controls className="w-full" />
            )}
        </div>
    )
}

export default Player
