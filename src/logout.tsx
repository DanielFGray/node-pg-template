import { useNavigate } from 'react-router-dom'
import { useAuth } from './Auth.ctx'

export default function Logout() {
  const navigate = useNavigate()
  const auth = useAuth()
  return (
    <form
      method="POST"
      onSubmit={ev => {
        ev.preventDefault()
        fetch('/logout', { method: 'post' })
          .then(() => {
            auth.setUser(null)
            navigate('/')
          })
      }}
    >
      <fieldset>
        <legend>log out</legend>

        <div>Are you sure you want to log out?</div>
        <div>
          <input type="submit" value="log out" />
        </div>
      </fieldset>
    </form>
  )
}
