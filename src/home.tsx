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
    setPosts(res)
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
        const form = validator.safeParse(Object.fromEntries(new FormData(ev.currentTarget)))
        if (!form.success) return setResponse(form.error.flatten())
        const body = new URLSearchParams(form.data)
        const res = await api<FormResult<Post[]>>('/posts', { method: 'post', body })
        setResponse(res)
        refetch()
      }}
    >
      <fieldset>
        <legend>new post</legend>
        <div>
          <textarea
            name="body"
            aria-describedby="new-post-help"
            aria-invalid={Boolean(response?.fieldErrors?.body)}
            style={{ width: '100%' }}
            data-cy="new-post-input"
          ></textarea>
          {response?.fieldErrors?.body?.map(e => (
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
