import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState([])

  const search = async () => {
    const res = await fetch('http://localhost:3001/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: query })
    })
    const data = await res.json()
    console.log(data.result)
    setResult(data.result)
  }

  return (
    <>
      <input onChange={(e) => setQuery(e.target.value)} type="text" placeholder='Enter your query' />
      <button onClick={search}>Search</button>
      <br />
      <div>
            <p style={{
              whiteSpace: 'pre-line',
            }} >
              {result}
            </p>
      </div>
    </>
  )
}

export default App
