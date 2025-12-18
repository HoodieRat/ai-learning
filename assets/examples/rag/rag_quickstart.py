"""Minimal RAG quickstart using local corpus and Chroma.

Requires:
  pip install "langchain>=0.2" "langchain-community>=0.2" chromadb sentence-transformers
Optional (for OpenAI fallback):
  pip install openai

Default LLM: ChatOllama (local). Set OLLAMA_HOST if remote. For OpenAI, set USE_OPENAI=1 and OPENAI_API_KEY.
"""

import os
from pathlib import Path

from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain_community.chat_models import ChatOllama
from langchain_community.document_loaders import TextLoader
from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter

try:
    from langchain_openai import ChatOpenAI  # type: ignore
except ImportError:  # pragma: no cover
    ChatOpenAI = None  # type: ignore

BASE_DIR = Path(__file__).parent
CORPUS_DIR = BASE_DIR / "corpus"
DB_DIR = BASE_DIR / ".chroma"

PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template=(
        "You are a concise assistant. Use only the provided context to answer. "
        "Cite sources as [file:section] for every claim. If no answer, say 'No supporting chunk.'\n"
        "Context:\n{context}\n\nQuestion: {question}\nAnswer with citations:"
    ),
)


def load_docs():
    docs = []
    for path in CORPUS_DIR.glob("*.md"):
        loader = TextLoader(str(path), encoding="utf-8")
        docs.extend(loader.load())
    return docs


def split_docs(docs):
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    return splitter.split_documents(docs)


def get_vectorstore(chunks):
    embeddings = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
    return Chroma.from_documents(chunks, embedding=embeddings, persist_directory=str(DB_DIR))


def get_llm():
    use_openai = os.getenv("USE_OPENAI") == "1" and ChatOpenAI is not None
    if use_openai:
        return ChatOpenAI(model="gpt-4o-mini", temperature=0)
    return ChatOllama(model=os.getenv("OLLAMA_MODEL", "llama3:8b"), temperature=0)


def build_chain():
    docs = load_docs()
    chunks = split_docs(docs)
    vectordb = get_vectorstore(chunks)
    retriever = vectordb.as_retriever(search_kwargs={"k": 3})
    llm = get_llm()
    return RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever,
        chain_type_kwargs={"prompt": PROMPT},
        return_source_documents=True,
    )


def main():
    chain = build_chain()
    questions = [
        "What is the PTO accrual cap?",
        "Who approves flights over $800?",
        "Do remote employees need VPN?",
    ]
    for q in questions:
        result = chain(q)
        answer = result["result"].strip()
        sources = {doc.metadata.get("source", "?") for doc in result["source_documents"]}
        print("---")
        print("Q:", q)
        print("A:", answer)
        print("Sources:", ", ".join(sorted(sources)))


if __name__ == "__main__":
    main()
