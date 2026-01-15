## 🔁 Git Workflow

To keep our collaboration smooth and organized, we follow a **feature → dev → main** branching strategy.

---

### 🧱 Branch Structure

- `main`: Production-ready code (used for deployment - **Niles** will be handling this).
- `dev`: Development branch where features are integrated.
- `feature/xyz`: One branch per task or page (e.g., `feature/announcements-page`).

---

### 🛠️ How to Contribute

#### 1. Start from `dev`

Make sure you’re always working from the latest `dev`:

```bash
git checkout dev
git pull origin dev
```

---

#### 2. **Create a New Feature Branch** (or work on an existing one)

If **you're creating a new feature branch**:

```bash
git checkout -b feature/your-feature-name
```

Example:

```bash
git checkout -b feature/announcements-page
```

If the **feature branch already exists**, simply check out the branch:

```bash
git checkout feature/your-existing-feature-name
```

Example:

```bash
git checkout feature/announcements-page
```

> ⚠️ If the branch hasn’t been pushed to GitHub yet, you can push it with:
>
> ```bash
> git push -u origin feature/your-feature-name
> ```

---

#### 3. Make Your Changes

After coding:

```bash
git add .
git commit -m "Describe your change"
git push -u origin feature/your-feature-name
```

> ⚠️ Please format your code before pushing.
>
> ```bash
> npm format
> ```

---

#### 4. Create a Pull Request → `dev`

- Go to GitHub.
- Open a Pull Request from your branch **into `dev`**.
- Add reviewers, and include screenshots if applicable.
- Once approved, merge it.

### 🔁 Sync Your Branch (Optional but Recommended)

If others merge to `dev` while you're working:

```bash
git checkout dev
git pull origin dev

git checkout feature/your-feature-name
git merge dev
```

---

### After Merge

- Delete your feature branch (optional).
