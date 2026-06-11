import React from 'react'
import Game from './Game.jsx'

export default function App() {
  return (
    <div
      style={{
        background: '#000',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Game />
    </div>
  )
}
