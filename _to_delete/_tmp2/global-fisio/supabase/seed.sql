-- =====================================================================
-- Global Fisio - Exercícios pré-cadastrados (seed)
-- Execute após o schema.sql. Seguro de rodar mais de uma vez
-- (atualiza o tipo de medição dos exercícios existentes).
--
-- Tipos de medição:
--   series_reps  -> séries x repetições (+ carga opcional)
--   series_tempo -> séries x tempo (isometrias, alongamentos, equilíbrio)
--   cardio       -> tempo + velocidade/distância/inclinação
-- =====================================================================

insert into public.exercises (name, category, description, measurement_type, default_sets, default_reps, default_duration_seconds) values
-- Fortalecimento - Membros inferiores (séries x reps)
('Agachamento livre',                'fortalecimento', 'Agachamento com peso corporal', 'series_reps', 3, 15, null),
('Agachamento na parede (wall sit)', 'fortalecimento', 'Isometria de quadríceps na parede', 'series_tempo', 3, 1, 30),
('Leg press',                        'fortalecimento', 'Pressão de pernas no aparelho', 'series_reps', 3, 12, null),
('Extensão de joelho (cadeira extensora)', 'fortalecimento', 'Fortalecimento de quadríceps', 'series_reps', 3, 12, null),
('Flexão de joelho (mesa flexora)',  'fortalecimento', 'Fortalecimento de isquiotibiais', 'series_reps', 3, 12, null),
('Elevação pélvica (ponte)',         'fortalecimento', 'Fortalecimento de glúteos e core', 'series_reps', 3, 15, null),
('Panturrilha em pé',                'fortalecimento', 'Flexão plantar em pé', 'series_reps', 3, 15, null),
('Abdução de quadril com faixa',     'fortalecimento', 'Fortalecimento de glúteo médio', 'series_reps', 3, 15, null),
('Avanço (afundo)',                  'fortalecimento', 'Lunge alternado', 'series_reps', 3, 10, null),
('Step up (subida no degrau)',       'fortalecimento', 'Subida unilateral no step', 'series_reps', 3, 10, null),
-- Fortalecimento - Membros superiores e tronco
('Rosca bíceps com halter',          'fortalecimento', 'Flexão de cotovelo com halteres', 'series_reps', 3, 12, null),
('Tríceps com faixa elástica',       'fortalecimento', 'Extensão de cotovelo com resistência', 'series_reps', 3, 12, null),
('Remada com faixa elástica',        'fortalecimento', 'Fortalecimento de dorsais e escápula', 'series_reps', 3, 12, null),
('Elevação lateral de ombro',        'fortalecimento', 'Abdução de ombro com halteres', 'series_reps', 3, 12, null),
('Rotação externa de ombro com faixa','fortalecimento', 'Fortalecimento do manguito rotador', 'series_reps', 3, 15, null),
('Flexão de ombro com bastão',       'fortalecimento', 'Elevação anterior assistida', 'series_reps', 3, 12, null),
('Prancha frontal',                  'fortalecimento', 'Isometria de core', 'series_tempo', 3, 1, 30),
('Abdominal supra',                  'fortalecimento', 'Flexão de tronco', 'series_reps', 3, 15, null),
-- Alongamento (séries x tempo)
('Alongamento de isquiotibiais',     'alongamento', 'Posterior de coxa', 'series_tempo', 3, 1, 30),
('Alongamento de quadríceps',        'alongamento', 'Anterior de coxa em pé', 'series_tempo', 3, 1, 30),
('Alongamento de panturrilha',       'alongamento', 'Na parede', 'series_tempo', 3, 1, 30),
('Alongamento de trapézio/cervical', 'alongamento', 'Inclinação lateral de pescoço', 'series_tempo', 3, 1, 30),
('Alongamento de peitoral na porta', 'alongamento', 'Abertura de ombros no batente', 'series_tempo', 3, 1, 30),
('Gato-camelo',                      'alongamento', 'Mobilidade de coluna em 4 apoios', 'series_reps', 3, 10, null),
-- Mobilidade
('Mobilização de tornozelo',         'mobilidade', 'Dorsiflexão com joelho à parede', 'series_reps', 3, 10, null),
('Mobilidade de quadril 90/90',      'mobilidade', 'Rotações internas/externas sentado', 'series_reps', 3, 10, null),
('Pêndulo de ombro (Codman)',        'mobilidade', 'Movimento pendular relaxado', 'series_tempo', 3, 1, 30),
('Rotação torácica',                 'mobilidade', 'Rotação de tronco em 4 apoios', 'series_reps', 3, 10, null),
-- Equilíbrio / Propriocepção
('Apoio unipodal',                   'propriocepcao', 'Equilíbrio em uma perna', 'series_tempo', 3, 1, 30),
('Apoio unipodal em superfície instável', 'propriocepcao', 'Disco/almofada proprioceptiva', 'series_tempo', 3, 1, 30),
('Marcha lateral com faixa',         'propriocepcao', 'Deslocamento lateral com mini band', 'series_reps', 3, 10, null),
('Treino de marcha',                 'propriocepcao', 'Marcha assistida/supervisionada', 'cardio', 1, 1, 600),
-- Condicionamento (cardio: tempo/velocidade/distância/inclinação)
('Bicicleta ergométrica',            'condicionamento', 'Aquecimento/condicionamento', 'cardio', 1, 1, 600),
('Esteira (caminhada)',              'condicionamento', 'Caminhada leve', 'cardio', 1, 1, 600)
on conflict (name) do update set
  measurement_type = excluded.measurement_type,
  default_duration_seconds = excluded.default_duration_seconds,
  category = excluded.category;
