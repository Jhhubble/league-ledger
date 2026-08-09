import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function League() {
  const { leagueId } = useParams()
  const navigate = useNavigate()

  const [league, setLeague] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [bets, setBets] = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)
  const [settlements, setSettlements] = useState([])
  const [payments, setPayments] = useState([])

  // Stores a separate wager amount for each bet
  const [joinAmount, setJoinAmount] = useState({})

  useEffect(() => {
    async function loadLeague() {
      // -------------------------
      // GET CURRENT USER
      // -------------------------

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setCurrentUserId(user.id)
      }

      // -------------------------
      // LOAD LEAGUE
      // -------------------------

      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId)
        .single()

      if (leagueError) {
        console.error(leagueError)
        setMessage('Could not load league.')
        setLoading(false)
        return
      }

      setLeague(leagueData)

      // -------------------------
      // LOAD MEMBERS
      // -------------------------

      const { data: memberData, error: memberError } = await supabase
        .from('league_members')
        .select(`
          id,
          role,
          user_id,
          profiles (
            username
          )
        `)
        .eq('league_id', leagueId)
        .eq('is_active', true)

      if (memberError) {
        console.error(memberError)
        setMessage('Could not load league members.')
      } else {
        setMembers(memberData || [])
      }

      // -------------------------
      // LOAD BETS
      // -------------------------

      const { data: betData, error: betError } = await supabase
        .from('bets')
        .select(`
          *,
          bet_positions (
            id,
            user_id,
            side,
            stake
          )
        `)
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false })

      if (betError) {
        console.error('Error loading bets:', betError)
      } else {
        setBets(betData || [])
      }

      const { data: settlementData, error: settlementError } = await supabase
        .from('bet_settlements')
        .select(`
            id,
            bet_id,
            from_user_id,
            to_user_id,
            amount
        `)
        .eq('league_id', leagueId)

        if (settlementError) {
        console.error('Error loading settlements:', settlementError)
        } else {
        setSettlements(settlementData || [])
        }

        const { data: paymentData, error: paymentError } = await supabase
            .from('settlement_payments')
            .select(`
                id,
                league_id,
                from_user_id,
                to_user_id,
                amount,
                status,
                created_at,
                confirmed_at
            `)
            .eq('league_id', leagueId)

            if (paymentError) {
            console.error('Error loading payments:', paymentError)
            } else {
            setPayments(paymentData || [])
            }



      setLoading(false)
    }

    loadLeague()
  }, [leagueId])

  // --------------------------------
  // ACCEPT / DECLINE
  // --------------------------------

  async function respondToBet(betId, response) {
    const { error } = await supabase.rpc('respond_to_bet', {
      target_bet_id: betId,
      response: response,
    })

    if (error) {
      console.error(error)
      setMessage(error.message)
      window.alert(error.message)
      return
    }

    window.location.reload()
  }

  async function cancelChallenge(betId) {
    const { error } = await supabase.rpc(
        'cancel_bet_challenge',
        {
        target_bet_id: betId,
        }
    )

    if (error) {
        console.error(error)
        setMessage(error.message)
        window.alert(error.message)
        return
    }

    window.location.reload()
    }



  // --------------------------------
  // CALCULATE TOTAL MONEY ON A SIDE
  // --------------------------------


 

    function getMemberOpenWager(userId) {
    const unresolvedStatuses = [
        'open',
        'locked',
        'awaiting_result',
        'disputed',
    ]

    return bets.reduce((total, bet) => {
        if (!unresolvedStatuses.includes(bet.status)) {
        return total
        }

        const userPositions = (bet.bet_positions || []).filter(
        (position) => position.user_id === userId
        )

        const userTotal = userPositions.reduce(
        (sum, position) => sum + Number(position.stake),
        0
        )

        return total + userTotal
    }, 0)
    }

    function getMemberSettledBalance(userId) {
    return settlements.reduce((total, settlement) => {
        const amount = Number(settlement.amount)

        if (settlement.to_user_id === userId) {
        return total + amount
        }

        if (settlement.from_user_id === userId) {
        return total - amount
        }

        return total
    }, 0)
    }


    function getMemberDebtBreakdown(userId) {
        const netByUser = {}

        // -------------------------
        // ADD BET SETTLEMENT DEBTS
        // -------------------------

        settlements.forEach((settlement) => {
            const amount = Number(settlement.amount)

            if (settlement.from_user_id === userId) {
            const otherUserId = settlement.to_user_id

            netByUser[otherUserId] =
                (netByUser[otherUserId] || 0) - amount
            }

            if (settlement.to_user_id === userId) {
            const otherUserId = settlement.from_user_id

            netByUser[otherUserId] =
                (netByUser[otherUserId] || 0) + amount
            }
        })

        // -------------------------
        // SUBTRACT CONFIRMED PAYMENTS
        // -------------------------

        payments
            .filter((payment) => payment.status === 'confirmed')
            .forEach((payment) => {
            const amount = Number(payment.amount)

            // This user paid someone
            // That reduces what this user owes them
            if (payment.from_user_id === userId) {
                const otherUserId = payment.to_user_id

                netByUser[otherUserId] =
                (netByUser[otherUserId] || 0) + amount
            }

            // Someone paid this user
            // That reduces what they owe this user
            if (payment.to_user_id === userId) {
                const otherUserId = payment.from_user_id

                netByUser[otherUserId] =
                (netByUser[otherUserId] || 0) - amount
            }
            })

        const owes = []
        const owedToYou = []

        Object.entries(netByUser).forEach(
            ([otherUserId, netAmount]) => {
            const otherMember = members.find(
                (member) => member.user_id === otherUserId
            )

            const name =
                otherMember?.profiles?.username || 'Unknown'

            if (netAmount > 0.005) {
                owedToYou.push({
                userId: otherUserId,
                name,
                amount: netAmount,
                })
            }

            if (netAmount < -0.005) {
                owes.push({
                userId: otherUserId,
                name,
                amount: Math.abs(netAmount),
                })
            }
            }
        )

        return {
            owes,
            owedToYou,
        }
        }

    function getUsernameByUserId(userId) {
        const member = members.find(
            (member) => member.user_id === userId
        )

        return member?.profiles?.username || 'Unknown'
        }

    // New helper    
    function getPendingPayment(fromUserId, toUserId) {
        return payments.find(
            (payment) =>
            payment.from_user_id === fromUserId &&
            payment.to_user_id === toUserId &&
            payment.status === 'pending'
        )
        }    

    function getMemberPendingChallenges(userId) {
    return bets.reduce((total, bet) => {
        if (bet.status !== 'pending') {
        return total
        }

        const userPositions = (bet.bet_positions || []).filter(
        (position) => position.user_id === userId
        )

        const userTotal = userPositions.reduce(
        (sum, position) => sum + Number(position.stake),
        0
        )

        return total + userTotal
    }, 0)
    }    
    
  function getPoolTotal(bet, side) {
    return (bet.bet_positions || [])
      .filter((position) => position.side === side)
      .reduce((total, position) => {
        return total + Number(position.stake)
      }, 0)
  }

  // --------------------------------
  // CALCULATE LIVE AMERICAN ODDS
  // --------------------------------

  function getAmericanOdds(forPool, againstPool) {
    if (forPool <= 0 || againstPool <= 0) {
      return null
    }

    if (againstPool >= forPool) {
      return `+${Math.round((againstPool / forPool) * 100)}`
    }

    return `${Math.round(-(forPool / againstPool) * 100)}`
  }

  const activeBets = bets.filter(
    (bet) => bet.status !== 'settled'
    )

  const settledBets = bets.filter(
    (bet) => 
        bet.status === 'settled' &&
        bet.hidden_from_history !== true
    )



  // --------------------------------
  // JOIN AN OPEN BET
  // --------------------------------

  async function joinBet(betId, side) {




    const amount = Number(joinAmount[betId])

    if (!amount || amount <= 0) {
      setMessage('Enter a valid wager amount.')
      return
    }

    const { error } = await supabase.rpc('join_bet', {
      target_bet_id: betId,
      chosen_side: side,
      wager_amount: amount,
    })

    if (error) {
      console.error(error)
      setMessage(error.message)
      window.alert(error.message)
      return
    }

    window.location.reload()
    }

      async function readyToBeginBet(betId) {
        const { error } = await supabase.rpc('ready_to_begin_bet', {
            target_bet_id: betId,
        })

        if (error) {
            console.error(error)
            setMessage(error.message)
            window.alert(error.message)
            return
        }

    window.location.reload()
    }
    

    async function reportResult(betId, winningSide) {
    const { error } = await supabase.rpc('report_bet_result', {
        target_bet_id: betId,
        winning_side: winningSide,
    })

    if (error) {
        console.error(error)
        setMessage(error.message)
        window.alert(error.message)
        return
    }

    window.location.reload()
    }

    async function confirmResult(betId) {
    const { error } = await supabase.rpc('confirm_bet_result', {
        target_bet_id: betId,
    })

    if (error) {
        console.error(error)
        setMessage(error.message)
        window.alert(error.message)
        return
    }

    window.location.reload()
    }

    async function settleBet(betId) {
    const { error } = await supabase.rpc('settle_bet', {
        target_bet_id: betId,
    })

    if (error) {
        console.error(error)
        setMessage(error.message)
        window.alert(error.message)
        return
    }

    window.location.reload()
    }  

    async function markDebtPaid(toUserId) {
        const { error } = await supabase.rpc('mark_debt_paid', {
            target_league_id: leagueId,
            target_to_user_id: toUserId,
        })

        if (error) {
            console.error(error)
            setMessage(error.message)
            window.alert(error.message)
            return
        }

    window.location.reload()
    }

    async function confirmPayment(paymentId) {
        const { error } = await supabase.rpc(
            'confirm_settlement_payment',
            {
            target_payment_id: paymentId,
            }
        )

        if (error) {
            console.error(error)
            setMessage(error.message)
            window.alert(error.message)
            return
        }

    window.location.reload()
    }

    async function hideBetFromHistory(betId) {
        const { error } = await supabase.rpc(
            'hide_bet_from_history',
            {
            target_bet_id: betId,
            }
        )

        if (error) {
            console.error(error)
            setMessage(error.message)
            window.alert(error.message)
            return
        }

    window.location.reload()
    }


    async function leaveLeague() {
    const confirmed = window.confirm(
        'Are you sure you want to leave this league?'
    )

    if (!confirmed) {
        return
    }

    const { error } = await supabase.rpc(
        'leave_league',
        {
            target_league_id: leagueId,
        }
    )

    if (error) {
        console.error(error)
        setMessage(error.message)
        window.alert(error.message)
        return
    }

    navigate('/home')
}

    
        
    


  // --------------------------------
  // LOADING / ERROR
  // --------------------------------

  if (loading) {
    return <p>Loading league...</p>
  }

  if (!league) {
    return <p>{message || 'League not found.'}</p>
  }

  // --------------------------------
  // PAGE
  // --------------------------------

  return (
    <div className="league-page">

      <button onClick={() => navigate('/home')}>
        ← Back
      </button>

      <h1>{league.name}</h1>

      <p>
        Invite Code: <strong>{league.invite_code}</strong>
      </p>

      {message && <p>{message}</p>}

      <hr />

      <h2>Active Bets</h2>

      {activeBets.length === 0 ? (
        <p>No bets yet.</p>
      ) : (
        activeBets.map((bet) => {
            const yesPool = getPoolTotal(bet, 'yes')
            const noPool = getPoolTotal(bet, 'no')

            const yesOdds = getAmericanOdds(yesPool, noPool)
            const noOdds = getAmericanOdds(noPool, yesPool)

            return (
                <div key={bet.id} className="bet-card">
                <div className="bet-header">
                    <h3>{bet.description}</h3>

                    <span className={`status-badge status-${bet.status.toLowerCase()}`}>
                        {bet.status.replaceAll('_', ' ')}
                    </span>
                    </div>

                    <div className="bet-details">
                    <span>
                        Creator Side:{' '}
                        <strong>{bet.creator_side.toUpperCase()}</strong>
                    </span>

                    <span>
                        Original Stake:{' '}
                        <strong>${Number(bet.initial_stake).toFixed(2)}</strong>
                    </span>
                </div>

                <div className="original-matchup">
                    <span>
                        {getUsernameByUserId(bet.creator_id)}
                        {'('}
                        {bet.creator_side.toUpperCase()}
                        {')'}
                    </span>

                    <span className="matchup-vs"></span>

                    <span>
                        {getUsernameByUserId(bet.opponent_id)}
                        {'('}
                        {bet.creator_side === 'yes' ? 'NO' : 'YES'}
                        {')'}
                    </span>
                </div>
            
                {/* ACCEPT / DECLINE */}

                {bet.status === 'pending' &&
                    bet.opponent_id === currentUserId && (
                    <div>
                        <button
                        className="btn-accept"
                        onClick={() =>
                            respondToBet(bet.id, 'accept')
                        }
                        >
                        Accept
                        </button>

                        <button
                        className="btn-decline"
                        onClick={() =>
                            respondToBet(bet.id, 'decline')
                        }
                        >
                        Decline
                        </button>
                    </div>
                )}
                {bet.status === 'pending' &&
                    bet.creator_id === currentUserId && (
                        <button
                        className="btn-cancel-challenge"
                        onClick={() => cancelChallenge(bet.id)}
                        >
                        Cancel Challenge
                        </button>
                )}




                {/* LIVE / FINAL ODDS */}

                {(bet.status === 'open' ||
                    bet.status === 'locked') && (
                        <div className="odds-box">

                        {/* YES SIDE */}
                        <div>
                            <h4>YES</h4>

                            <p>
                            $
                            {bet.status === 'locked'
                                ? Number(bet.locked_yes_pool).toFixed(2)
                                : yesPool.toFixed(2)}
                            {' '}backed
                            </p>

                            <strong>
                            {bet.status === 'locked'
                                ? `${bet.locked_yes_odds > 0 ? '+' : ''}${bet.locked_yes_odds}`
                                : yesOdds || 'N/A'}
                            </strong>

                            <div className="side-bettors">
                            {(bet.bet_positions || [])
                                .filter((position) => position.side === 'yes')
                                .map((position) => (
                                <div
                                    key={position.id}
                                    className="side-bettor"
                                >
                                    <span>
                                    {getUsernameByUserId(position.user_id)}
                                    </span>

                                    <span>
                                    ${Number(position.stake).toFixed(2)}
                                    </span>
                                </div>
                                ))}
                            </div>
                        </div>


                        {/* NO SIDE */}
                        <div>
                            <h4>NO</h4>

                            <p>
                            $
                            {bet.status === 'locked'
                                ? Number(bet.locked_no_pool).toFixed(2)
                                : noPool.toFixed(2)}
                            {' '}backed
                            </p>

                            <strong>
                            {bet.status === 'locked'
                                ? `${bet.locked_no_odds > 0 ? '+' : ''}${bet.locked_no_odds}`
                                : noOdds || 'N/A'}
                            </strong>

                            <div className="side-bettors">
                            {(bet.bet_positions || [])
                                .filter((position) => position.side === 'no')
                                .map((position) => (
                                <div
                                    key={position.id}
                                    className="side-bettor"
                                >
                                    <span>
                                    {getUsernameByUserId(position.user_id)}
                                    </span>

                                    <span>
                                    ${Number(position.stake).toFixed(2)}
                                    </span>
                                </div>
                                ))}
                            </div>
                        </div>

                        </div>

                      
                    )}

                {/* JOIN BET */}

                {bet.status === 'open' && (
                    <div className="join-bet-area">

                    <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Wager amount"
                        value={joinAmount[bet.id] || ''}
                        onChange={(e) =>
                        setJoinAmount({
                            ...joinAmount,
                            [bet.id]: e.target.value,
                        })
                        }
                    />

                    <button
                        onClick={() =>
                        joinBet(bet.id, 'yes')
                        }
                    >
                        Back YES
                    </button>

                    <button
                        onClick={() =>
                        joinBet(bet.id, 'no')
                        }
                    >
                        Back NO
                    </button>

                    </div>
                )}

                {/* LET THE BET BEGIN */}

                {bet.status === 'open' &&
                    (bet.creator_id === currentUserId ||
                    bet.opponent_id === currentUserId) && (
                    <div className="begin-bet-area">

                        <p>
                        Creator ready:{' '}
                        <strong>
                            {bet.creator_ready ? '✓' : 'Waiting'}
                        </strong>
                        </p>

                        <p>
                        Opponent ready:{' '}
                        <strong>
                            {bet.opponent_ready ? '✓' : 'Waiting'}
                        </strong>
                        </p>

                        <button
                        onClick={() =>
                            readyToBeginBet(bet.id)
                        }
                        >
                        Let the Bet Begin
                        </button>

                    </div>
                    )}

                {/* LOCKED BET */}

                {bet.status === 'locked' && (
                    <div className="locked-bet">

                    <h3>🔒 BET LOCKED</h3>

                    <p>
                        Final Pool: $
                        {(
                        Number(bet.locked_yes_pool) +
                        Number(bet.locked_no_pool)
                        ).toFixed(2)}
                    </p>

                    <p>
                        No more wagers can be added.
                    </p>

                    </div>
                )}

   
                {/* RESULT REPORTING */}

                {bet.status === 'locked' &&
                (currentUserId === bet.creator_id ||
                currentUserId === bet.opponent_id) && (
                <div className="result-box">
                <h3>Who Won?</h3>

                <button
                    onClick={() => reportResult(bet.id, 'yes')}
                >
                    YES Won
                </button>

                <button
                    onClick={() => reportResult(bet.id, 'no')}
                >
                    NO Won
                </button>
                </div>
                )}

                {/* RESULT CONFIRMATION */}

                {bet.status === 'awaiting_result' && (
                <div className="result-box">

                    <h3>Result Reported</h3>

                    <p>
                    Reported winner:{' '}
                    <strong>
                        {bet.reported_winner?.toUpperCase()}
                    </strong>
                    </p>

                    {currentUserId !== bet.result_reported_by &&
                    (currentUserId === bet.creator_id ||
                        currentUserId === bet.opponent_id) && (
                        <button
                        onClick={() => confirmResult(bet.id)}
                        >
                        Confirm Result
                        </button>
                    )}

                    {bet.result_confirmed === true &&
                    (currentUserId === bet.creator_id ||
                        currentUserId === bet.opponent_id) && (
                        <div className="settlement-box">

                        <p>✓ Result confirmed</p>

                        <button
                            onClick={() => settleBet(bet.id)}
                        >
                            Settle Bet
                        </button>

                        </div>
                    )}

                </div>
                )}

                {/* SETTLED DISPLAY */}

                {bet.status === 'settled' && (
                <div className="settlement-box">

                    <h3>✓ BET SETTLED</h3>

                    <p>
                    Winner:{' '}
                    <strong>
                        {bet.reported_winner?.toUpperCase()}
                    </strong>
                    </p>

                </div>
                )}


                </div>
            )
            })
        )}

      <button
      className="create-bet-btn"
        onClick={() =>
          navigate(`/league/${leagueId}/create-bet`)
        }
      >
        + Create Bet
      </button>

      <hr />
      <h2>Bet History</h2>

        {settledBets.length === 0 ? (
        <p>No settled bets yet.</p>
        ) : (
        settledBets.map((bet) => {
            const yesPool = Number(bet.locked_yes_pool || 0)
            const noPool = Number(bet.locked_no_pool || 0)

            const finalPool = yesPool + noPool

            return (
            <div key={bet.id} className="bet-card">

                <h3>{bet.description}</h3>

                <p>
                Status:{' '}
                <strong>SETTLED</strong>
                </p>

                <p>
                Winner:{' '}
                <strong>
                    {bet.reported_winner?.toUpperCase()}
                </strong>
                </p>

                <p>
                Final YES Pool:{' '}
                <strong>
                    ${yesPool.toFixed(2)}
                </strong>
                </p>

                <p>
                Final NO Pool:{' '}
                <strong>
                    ${noPool.toFixed(2)}
                </strong>
                </p>

                <p>
                Final Pool:{' '}
                <strong>
                    ${finalPool.toFixed(2)}
                </strong>
                </p>

                <p>
                Final YES Odds:{' '}
                <strong>
                    {bet.locked_yes_odds > 0 ? '+' : ''}
                    {bet.locked_yes_odds}
                </strong>
                </p>

                <p>
                Final NO Odds:{' '}
                <strong>
                    {bet.locked_no_odds > 0 ? '+' : ''}
                    {bet.locked_no_odds}
                </strong>
                </p>
                
                <h4>Results</h4>

                {(bet.bet_positions || []).map((position) => {
                const isWinner =
                    position.side === bet.reported_winner

                let resultAmount = 0

                if (isWinner) {
                    const winningPool =
                    bet.reported_winner === 'yes'
                        ? Number(bet.locked_yes_pool)
                        : Number(bet.locked_no_pool)

                    const losingPool =
                    bet.reported_winner === 'yes'
                        ? Number(bet.locked_no_pool)
                        : Number(bet.locked_yes_pool)

                    resultAmount =
                    Number(position.stake) *
                    (losingPool / winningPool)
                } else {
                    resultAmount = -Number(position.stake)
                }

                return (
                    <p key={position.id}>
                    {getUsernameByUserId(position.user_id)}
                    {' — '}
                    {position.side.toUpperCase()}
                    {' — '}
                    <strong>
                        {resultAmount >= 0 ? '+' : '-'}$
                        {Math.abs(resultAmount).toFixed(2)}
                    </strong>
                    </p>
                )
                })}

                <button
                    className="btn-remove-history"
                    onClick={() => hideBetFromHistory(bet.id)}
                >
                    Remove from History
                </button>    

            </div>
            )
        })
        )}

        <hr />
      

      <h2>Standings</h2>

    {members.map((member) => {
    const openWagers = getMemberOpenWager(member.user_id)

    const pendingChallenges = 
        getMemberPendingChallenges(member.user_id)

    const settledBalance =
        getMemberSettledBalance(member.user_id)

    const currentBalance =
        settledBalance - openWagers

    const { owes, owedToYou } =
        getMemberDebtBreakdown(member.user_id)

    return (
        <div key={member.id} className="standing-card">
        <h3>
        {member.profiles?.username}
        {member.role === 'owner' && ' 👑'}
        </h3>

        <div className="balance-grid">

        <div className="balance-item">
            <span>Current Balance</span>
            <strong>
            {currentBalance >= 0 ? '+' : '-'}$
            {Math.abs(currentBalance).toFixed(2)}
            </strong>
        </div>

        <div className="balance-item">
            <span>Active Wagers</span>
            <strong>
            ${openWagers.toFixed(2)}
            </strong>
        </div>

        <div className="balance-item">
            <span>Pending Challenges</span>
            <strong>
            ${pendingChallenges.toFixed(2)}
            </strong>
        </div>

        <div className="balance-item">
            <span>Settled P/L</span>
            <strong>
            {settledBalance >= 0 ? '+' : '-'}$
            {Math.abs(settledBalance).toFixed(2)}
            </strong>
        </div>

        </div>

       {owes.length > 0 && (
            <div>
                <h4>You Owe</h4>

                {owes.map((debt, index) => (
                    <div key={index}>
                        <p>
                            {debt.name}: ${debt.amount.toFixed(2)}
                        </p>
                        {member.user_id === currentUserId && (() => {
                        const pendingPayment =
                            getPendingPayment(member.user_id, debt.userId)

                        return pendingPayment ? (
                            <p>
                            Payment marked as paid — awaiting confirmation
                            </p>
                        ) : (
                            <button
                            onClick={() => markDebtPaid(debt.userId)}
                            >
                            Mark as Paid
                            </button>
                        )
                        })()}
                    </div>
                ))}
            </div>
        )}

        {owedToYou.length > 0 && (
        <div>
            <h4>Owed To You</h4>

            {owedToYou.map((debt, index) => {
            const pendingPayment =
                getPendingPayment(debt.userId, member.user_id)

            return (
                <div key={index}>

                <p>
                    {debt.name} owes you $
                    {debt.amount.toFixed(2)}
                </p>

                {pendingPayment &&
                    member.user_id === currentUserId && (
                    <div>

                        <p>
                        {debt.name} marked $
                        {Number(pendingPayment.amount).toFixed(2)}
                        {' '}as paid.
                        </p>

                        <button
                        onClick={() =>
                            confirmPayment(pendingPayment.id)
                        }
                        >
                        Confirm Payment
                        </button>

                    </div>
                    )}

                </div>
                )
            })}

          </div>
        )}

      </div>
    )
  })}



      <hr />

      <h2>Members</h2>

      {members.map((member) => (
        <p key={member.id}>
          {member.profiles?.username}
        </p>
      ))}


      {members.find(
        (member) => member.user_id === currentUserId
        )?.role !== 'owner' && (
        <button
            className="btn-decline"
            onClick={leaveLeague}
        >
            Leave League
        </button>
        )}

    </div>
  )
}

export default League