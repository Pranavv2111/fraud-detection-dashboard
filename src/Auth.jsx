import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('LOGIN ERROR:', error);
      setError(error.code + '-' + error.message);
    }
  };

  return (
    <div className="authPage">
      <div className="authContainer">
        <h1>Fraud Detection Dashboard</h1>
        <p className="authSubtitle">
          Sign in to monitor and investigate transactions.
        </p>

        <form className="authForm" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Enter you email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Enter you password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">Login</button>
        </form>

        {error && <p className="authError">{error}</p>}
      </div>
    </div>
  );
}

export default Auth;
