import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function CreateBet() {
  const { leagueId } = useParams()
  const navigate = useNavigate()

  const [members, setMembers] = useState([])
  const [opponentId, setOpponentId] = useState('')
  const [description, setDescription] = useState('')
  const [creatorSide, setCreatorSide] = useState('yes')
  const [stake, setStake] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMembers() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('league_members')
        .select(`
          user_id,
          profiles (
            username
          )
        `)
        .eq('league_id', leagueId)
        .eq('is_active', true)
        .neq('user_id', user.id)

      if (error) {
        console.error(error)
        setMessage('Could not load league members.')
      } else {
        setMembers(data || [])
      }

      setLoading(false)
    }

    loadMembers()
  }, [leagueId])

  async function handleCreateBet(e) {
    e.preventDefault()

    setMessage('Creating bet...')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You must be logged in.')
      return
    }

    if (!opponentId) {
      setMessage('Choose someone to bet against.')
      return
    }

    const stakeNumber = Number(stake)

    if (!stakeNumber || stakeNumber <= 0) {
      setMessage('Enter a valid wager amount.')
      return
    }


    const { error } = await supabase.rpc(
        'create_bet_with_position',
        {
            target_league_id: leagueId,
            target_opponent_id: opponentId,
            bet_description: description,
            creator_position: creatorSide,
            wager_amount: stakeNumber,
        }
        )

        if (error) {
        console.error(error)
        setMessage(error.message)
        window.alert(error.message)
        return
        }

        navigate(`/league/${leagueId}`)
    }

  if (loading) {
    return <p>Loading members...</p>
  }

  return (
    <div className="auth-page">
      <h1>Create Bet</h1>

      <form onSubmit={handleCreateBet}>
        <label>Bet Against</label>

        <select
          value={opponentId}
          onChange={(e) => setOpponentId(e.target.value)}
          required
        >
          <option value="">
            Select a league member
          </option>

          {members.map((member) => (
            <option
              key={member.user_id}
              value={member.user_id}
            >
              {member.profiles?.username}
            </option>
          ))}
        </select>

        <label>Proposition</label>

        <textarea
          placeholder="Example: Sam can eat 10 Big Macs in one hour"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <label>My Position</label>

        <select
          value={creatorSide}
          onChange={(e) => setCreatorSide(e.target.value)}
        >
          <option value="yes">YES</option>
          <option value="no">NO</option>
        </select>

        <label>My Stake ($)</label>

        <input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="10.00"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          required
        />

        <button type="submit">
          Create Bet
        </button>
      </form>

      {message && <p>{message}</p>}
    </div>
  )
}

export default CreateBet