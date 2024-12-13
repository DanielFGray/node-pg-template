/// <reference types="Cypress" />

const postText = 'hello world! this is a test post from cypress'

context('Post creation', () => {
  beforeEach(() => cy.serverCommand('clearTestUsers'))
  it('can create a post', () => {
    // Setup
    cy.login({ redirectTo: '/', verified: true })

    // Action
    cy.getCy('new-post-input').type(postText)
    cy.getCy('new-post-submit').click()

    // Assertion
    cy.contains(postText).should('exist')
  })
})
