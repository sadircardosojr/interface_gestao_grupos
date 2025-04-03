-- Criar o banco de dados
CREATE DATABASE tree_db;

-- Criar a tabela de nós
CREATE TABLE nodes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES nodes(id)
);

-- Criar a tabela de condições
CREATE TABLE node_conditions (
    id SERIAL PRIMARY KEY,
    node_id INTEGER REFERENCES nodes(id),
    condition_type VARCHAR(50) NOT NULL,
    condition_value TEXT NOT NULL,
    condition_result TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir alguns dados de exemplo
INSERT INTO nodes (name, parent_id) VALUES
    ('Raiz 1', NULL),
    ('Raiz 2', NULL),
    ('Filho 1.1', 1),
    ('Filho 1.2', 1),
    ('Filho 2.1', 2),
    ('Neto 1.1.1', 3),
    ('Neto 1.1.2', 3),
    ('Neto 1.2.1', 4),
    ('Neto 2.1.1', 5); 