import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

export default function Header() {
  const { user, logout } = useContext(AuthContext);
  return (
    <header style={{ display:'flex', justifyContent:'space-between', padding:'1rem' }}>
      <Link to="/"><h1>LogicBuilders</h1></Link>
      <nav>
        {user ? (
          <>
            <span>Hi, {user.username}</span>
            <button onClick={logout}>Log Out</button>
          </>
        ) : (
          <>
            <Link to="/login"><button>Log In</button></Link>
            <Link to="/signup"><button>Sign Up</button></Link>
          </>
        )}
      </nav>
    </header>
  );
}
