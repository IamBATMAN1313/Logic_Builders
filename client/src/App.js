import { useEffect, useState } from 'react'
import axios from 'axios'

function App() {
  const [now, setNow] = useState('')

  useEffect(() => {
    axios.get('/api/hello')
      .then(res => setNow(res.data.now))
      .catch(err => {
        console.error(err)
        setNow('Error loading time')
      })
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>LogicBuilders PERN Demo</h1>
      <p>Server time is: <code>{now || 'Loading…'}</code></p>
    </div>
  )
}

export default App
