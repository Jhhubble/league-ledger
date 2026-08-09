import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function JoinLeague() {
  const [inviteCode, setInviteCode] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  async function handleJoinLeague(e) {
    e.preventDefault()

    setMessage('Joining league...')

    const { data, error } = await supabase.rpc(
      'join_league_by_code',
      {
        code: inviteCode,
      }
    )

    if (error) {
      console.error(error)
      setMessage(error.message)
      window.alert(error.message)
      return
    }

    navigate(`/league/${data}`)
  }

  return (
    <div className="auth-page">

      <h1>Join League</h1>

      <form onSubmit={handleJoinLeague}>

        <input
          type="text"
          placeholder="Invite Code"
          value={inviteCode}
          onChange={(e) =>
            setInviteCode(e.target.value.toUpperCase())
          }
          required
        />

        <button type="submit">
          Join League
        </button>

      </form>

      {message && <p>{message}</p>}

    </div>
  )
}

export default JoinLeague