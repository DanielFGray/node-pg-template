import { useNavigate } from 'react-router'
import { useAuth } from './Auth.ctx.js'
import { api } from './api.js'

export default function Logout() {
  const navigate = useNavigate()
  const auth = useAuth()
  if (!auth.user) {
    navigate('/')
    return null
  }
  return (
    <form
      method="POST"
      onSubmit={ev => {
        ev.preventDefault()
        api('/logout', { method: 'post' }).then(() => {
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
