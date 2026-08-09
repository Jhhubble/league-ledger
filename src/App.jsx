import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'
import CreateLeague from './pages/CreateLeague'
import League from './pages/League'
import JoinLeague from './pages/JoinLeague'
import CreateBet from './pages/CreateBet'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />

      <Route path="/login" element={<Login />} />

      <Route path="/register" element={<Register />} />

      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create-league"
        element={
          <ProtectedRoute>
            <CreateLeague />
          </ProtectedRoute>
        }
      />
      <Route
        path="/league/:leagueId"
        element={
          <ProtectedRoute>
            <League />
          </ProtectedRoute>
        }
      />
      <Route
        path="/join-league"
        element={
          <ProtectedRoute>
            <JoinLeague />
          </ProtectedRoute>
        }
      />
      <Route
        path="/league/:leagueId/create-bet"
        element={
          <ProtectedRoute>
            <CreateBet />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App