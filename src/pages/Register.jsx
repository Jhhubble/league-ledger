import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'



function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleRegister(e) {
    e.preventDefault()
    setMessage('Creating account...')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    })

    if (error) {
      setMessage(error.message)
      return
    }

    if (data.user) {
      setMessage('Account created! Check your email if confirmation is required.')
    }
  }

  return (
    <div className="auth-page">
      <h1>Create Account</h1>

      <form onSubmit={handleRegister}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength="6"
        />

        <button type="submit">
          Create Account
        </button>
      </form>

      {message && <p>{message}</p>}
      <p>
        Already have an account?{' '}
        <Link to="/login">Login</Link>
       </p>
    </div>
  )
}

export default Register