import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import Game from './pages/Game'

function App() {
  const [showGame, setShowGame] = useState(false)

  if (showGame) {
    return <Game />
  }

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Mars Oasis PBL</h1>
          <p>K12 Project-Based Learning — Phaser.js 2D game engine</p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => setShowGame(true)}
        >
          Start Game
        </button>
      </section>
    </>
  )
}

export default App
