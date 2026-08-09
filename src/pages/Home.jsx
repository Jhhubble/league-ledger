import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

function Home() {
  const navigate = useNavigate()

  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLeagues() {
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
          role,
          leagues (
            id,
            name,
            invite_code
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (error) {
        console.error('Error loading leagues:', error)
      } else {
        setLeagues(data || [])
      }

      setLoading(false)
    }

    loadLeagues()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="home-page">

      <h1>League Ledger</h1>

      <h2>Your Leagues</h2>

      {loading ? (
        <p>Loading leagues...</p>
      ) : leagues.length === 0 ? (
        <p>You haven't joined any leagues yet.</p>
      ) : (
        <div>
          {leagues.map((membership) => (
            <div
              key={membership.leagues.id}
              className="league-card"
              onClick={() =>
                navigate(`/league/${membership.leagues.id}`)
              }
            >
              <h3>{membership.leagues.name}</h3>

              <p>
                {membership.role === 'owner'
                  ? 'League Owner'
                  : 'League Member'}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="home-actions">

        <button onClick={() => navigate('/create-league')}>
          + Create League
        </button>

        <button onClick={() => navigate('/join-league')}>
          Join League
        </button>

      </div>

      <button onClick={handleLogout}>
        Logout
      </button>

    </div>
  )
}

export default Home