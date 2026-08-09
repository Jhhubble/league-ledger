import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function CreateLeague() {
  const [leagueName, setLeagueName] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  function generateInviteCode() {
    return Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()
  }

  async function handleCreateLeague(e) {
    e.preventDefault()

    setMessage('Creating league...')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You must be logged in.')
      return
    }

    const inviteCode = generateInviteCode()

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name: leagueName,
        owner_id: user.id,
        invite_code: inviteCode,
      })
      .select()
      .single()

    if (leagueError) {
      console.error(leagueError)
      setMessage(leagueError.message)
      return
    }

    const { error: memberError } = await supabase
      .from('league_members')
      .insert({
        league_id: league.id,
        user_id: user.id,
        role: 'owner',
      })

    if (memberError) {
      console.error(memberError)
      setMessage(memberError.message)
      return
    }

    navigate(`/league/${league.id}`)
  }

  return (
    <div className="auth-page">
      <h1>Create League</h1>

      <form onSubmit={handleCreateLeague}>
        <input
          type="text"
          placeholder="League Name"
          value={leagueName}
          onChange={(e) => setLeagueName(e.target.value)}
          required
        />

        <button type="submit">
          Create League
        </button>
      </form>

      {message && <p>{message}</p>}
    </div>
  )
}

export default CreateLeague