import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import SearchBar from '../ReUse/SearchBar';

export default function Header() {
  const { user, logout } = useContext(AuthContext);
return (
    <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem', flexWrap:'wrap', gap:'1rem' }}>
        <Link to="/"><h1>LogicBuilders</h1></Link>
        
        <div style={{ flex: 1, maxWidth: '400px' }}>
            <SearchBar />
        </div>
        
        <nav>
            {/*can't use else if in JSX, so use ternary operator or make it a function*/}
            {user ? (
                <>
                    <span>Hi, {user.username} {"  "}</span>
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
