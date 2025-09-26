import { useEffect, useState } from 'react'
import { api } from '#app/api.js'
import { useAuth } from '#app/Auth.ctx.js'
import { Form, Spinner, UnverifiedAccountWarning } from '#app/components.js'
import type { FormResult, Post } from '#app/types.js'
import { createPost as validator } from '#app/schemas.js'

export default function Home() {
  const auth = useAuth()
  const [posts, setPosts] = useState<FormResult<Post[]>>([])
  async function refetch() {
    const { data } = await api<FormResult<Post[]>>('/posts')
    setPosts(data)
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
    <Form
      prefix="newpost"
      response={response}
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
            aria-describedby="newpost-body-help"
            aria-invalid={Boolean(response?.fieldErrors?.body)}
            className="w-full"
            data-cy="newpost-body-input"
            placeholder="what's on your mind?"
          />
          {response?.fieldErrors?.body?.map(e => (
            <div className="field-error" key={e} id="newpost-body-help">
              {e}
            </div>
          ))}
        </div>

        <div className="form-row">
          <label htmlFor="newpost-privacy-input">privacy: </label>
          <div>
            <select
              className="w-full"
              name="privacy"
              id="newpost-privacy-input"
              data-cy="newpost-privacy-input"
            >
              <option value="public">public</option>
              <option value="private">private</option>
            </select>
          </div>
        </div>

        <button type="submit" data-cy="newpost-submit-button">
          send
        </button>
        <Form.Errors />
      </fieldset>
    </Form>
  )
}
