/**
 * main push 의 freeze 를 건너뛰어도 되는 경우만 skip=true.
 * 조건(모두 충족): push 커밋 메시지에서 PR 번호가 하나만 정해지고,
 * 그 PR head 의 git tree SHA 가 이 push 와 같고,
 * 그 head SHA 의 체크 이름이 정확히 freeze 이며 conclusion 이 success.
 * 하나라도 애매하면 skip=false. 예외도 skip=false. 종료코드는 항상 0.
 */
import fs from 'node:fs'

const out = process.env.GITHUB_OUTPUT

function emit(skip, reason) {
  console.log(`freeze-reuse skip=${skip} reason=${reason}`)
  if (out) fs.appendFileSync(out, `skip=${skip}\n`)
}

async function gh(path) {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('no token')
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'bongtour-freeze-reuse',
      'x-github-api-version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`github ${res.status}`)
  return res.json()
}

function pullNumber(message) {
  const first = String(message ?? '').split('\n')[0] ?? ''
  const squash = first.match(/\(#(\d+)\)\s*$/)
  if (squash) return squash[1]
  const merge = first.match(/^Merge pull request #(\d+)\b/)
  return merge ? merge[1] : null
}

async function freezeSucceeded(repo, headSha) {
  for (let page = 1; page <= 5; page++) {
    const data = await gh(`/repos/${repo}/commits/${headSha}/check-runs?per_page=100&page=${page}`)
    const runs = Array.isArray(data.check_runs) ? data.check_runs : []
    for (const run of runs) {
      if (run.name === 'freeze' && run.conclusion === 'success' && run.head_sha === headSha) return true
    }
    if (runs.length < 100) return false
  }
  return false
}

async function main() {
  try {
    if (process.env.GITHUB_EVENT_NAME !== 'push') {
      emit('false', 'not-push')
      return
    }
    const ref = process.env.GITHUB_REF ?? ''
    if (ref !== 'refs/heads/main' && ref !== 'refs/heads/master') {
      emit('false', 'not-default-branch')
      return
    }
    const repo = process.env.GITHUB_REPOSITORY
    const sha = process.env.GITHUB_SHA
    if (!repo || !sha) {
      emit('false', 'missing-ref')
      return
    }
    const push = await gh(`/repos/${repo}/commits/${sha}`)
    const number = pullNumber(push.commit?.message)
    if (!number) {
      emit('false', 'no-pr-number')
      return
    }
    const pr = await gh(`/repos/${repo}/pulls/${number}`)
    const headSha = pr.head?.sha
    if (!headSha) {
      emit('false', 'no-pr-head')
      return
    }
    const head = await gh(`/repos/${repo}/commits/${headSha}`)
    const pushTree = push.commit?.tree?.sha
    const headTree = head.commit?.tree?.sha
    if (!pushTree || !headTree || pushTree !== headTree) {
      emit('false', 'tree-mismatch')
      return
    }
    if (!(await freezeSucceeded(repo, headSha))) {
      emit('false', 'no-successful-freeze')
      return
    }
    emit('true', 'same-tree')
  } catch {
    emit('false', 'lookup-failed')
  }
}

main()
