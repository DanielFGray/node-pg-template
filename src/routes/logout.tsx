import { useNavigate } from 'react-router'
import { useAuth } from '#app/Auth.ctx.js'
import { api } from '#app/api.js'

export default function Logout() {
  const navigate = useNavigate()
  const auth = useAuth()
  if (!auth.user) {
    navigate('/')
    return null
  }
  return (
    <form
      onSubmit={async ev => {
        ev.preventDefault()
        await api('/logout', { method: 'post' })
        auth.setUser(null)
        navigate('/')
      }}
    >
      <fieldset>
        <legend>log out</legend>

        <div>Are you sure you want to log out?</div>
        <div>
          <input type="submit" value="log out" data-cy="logout-submit" />
        </div>
      </fieldset>
    </form>
  )
}
