import { useEffect, useState } from 'react'
import { api } from './api.js'
import { useAuth } from './Auth.ctx.js'
import { FormErrors, Spinner, UnverifiedAccountWarning } from './components.js'
import type { FormResult, Post } from './types.js'
import { createPost as validator } from './schemas.js'

export default function Home() {
  const auth = useAuth()
  const [posts, setPosts] = useState<FormResult<Post[]>>([])
  async function refetch() {
    const res = await api<FormResult<Post[]>>('/posts')
    if (!res.ok) return setPosts(res.error)
    setPosts(res.data)
  }
  useEffect(() => {
    refetch()
  }, [])
  if (!posts) return <Spinner />
  const data = { currentUser: auth?.user, posts }
  return (
    <>
      <h1>Home</h1>
      {!auth.user ? null : auth.user.is_verified ? null : <UnverifiedAccountWarning />}
      {auth.user ? <NewPost refetch={refetch} /> : null}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </>
  )
}

function NewPost({ refetch }: { refetch: () => void }) {
  const [response, setResponse] = useState<FormResult<Post[]>>()
  return (
    <form
      onSubmit={async ev => {
        ev.preventDefault()
        const form = validator.safeParse(Object.fromEntries(new FormData(ev.currentTarget) as any))
        if (!form.success) return setResponse({ ok: false, ...form.error.flatten() })
        const body = new URLSearchParams(form.data)
        const res = await api<FormResult<Post[]>>('/posts', { method: 'post', body })
        if (!res.ok) return setResponse(res.error)
        setResponse(res.data)
        refetch()
      }}
    >
      <fieldset>
        <legend>new post</legend>
        <div>
          <textarea
            name="body"
            aria-describedby="new-post-help"
            aria-invalid={Boolean(response?.fieldErrors?.username)}
            style={{ width: '100%' }}
            data-cy="new-post-input"
          ></textarea>
          {response?.fieldErrors?.username?.map(e => (
            <div className="field-error" key={e} id="new-post-help">
              {e}
            </div>
          ))}
        </div>

        <div className="form-row">
          <label htmlFor="new-post-privacy-input">privacy: </label>
          <div>
            <select name="privacy" id="new-post-privacy-input" data-cy="new-post-privacy-input">
              <option value="public">public</option>
              <option value="private">private</option>
            </select>
          </div>
        </div>

        <button type="submit" data-cy="new-post-submit">
          send
        </button>
        <FormErrors response={response} />
      </fieldset>
    </form>
  )
}
